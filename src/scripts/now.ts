import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const noRelease = args.includes("--no-release");
const root = process.cwd();
const distRoot = join(root, "dist");
const formulaPath = join(distRoot, "interactor.rb");

type Target = {
	label: string;
	bunTarget: string;
	binaryName: string;
};

const targets: Target[] = [
	{
		label: "darwin-arm64",
		bunTarget: "bun-darwin-arm64",
		binaryName: "interactor",
	},
	{
		label: "darwin-x64",
		bunTarget: "bun-darwin-x64",
		binaryName: "interactor",
	},
	{
		label: "linux-x64",
		bunTarget: "bun-linux-x64",
		binaryName: "interactor",
	},
	{
		label: "linux-arm64",
		bunTarget: "bun-linux-arm64",
		binaryName: "interactor",
	},
	{
		label: "windows-x64",
		bunTarget: "bun-windows-x64",
		binaryName: "interactor.exe",
	},
];

const bunBuildExternals = [
	"--external",
	"electron",
	"--external",
	"chromium-bidi/lib/cjs/bidiMapper/BidiMapper",
	"--external",
	"chromium-bidi/lib/cjs/cdp/CdpConnection",
];

async function run(command: string[], cwd = root): Promise<void> {
	const proc = Bun.spawn(command, {
		cwd,
		stdio: ["inherit", "inherit", "inherit"],
	});
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`Command failed (${code}): ${command.join(" ")}`);
	}
}

async function runCapture(
	command: string[],
	cwd = root,
): Promise<{ code: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn(command, {
		cwd,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const [code, stdout, stderr] = await Promise.all([
		proc.exited,
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	return { code, stdout, stderr };
}

async function sha256(path: string): Promise<string> {
	const proc = Bun.spawn(["shasum", "-a", "256", path], {
		stdio: ["ignore", "pipe", "inherit"],
	});
	const code = await proc.exited;
	if (code !== 0) throw new Error(`Failed to compute sha256 for ${path}`);
	const out = await new Response(proc.stdout).text();
	return out.trim().split(/\s+/)[0] ?? "";
}

function resolveReleaseTag(input: string): string {
	const tag = input.trim();
	if (tag.length === 0) {
		throw new Error("Release tag cannot be empty");
	}
	if (tag.startsWith("v")) {
		throw new Error(`Release tag must not start with 'v': ${tag}`);
	}
	return tag;
}

async function buildArtifacts(tag: string, repo: string): Promise<void> {
	await rm(distRoot, { recursive: true, force: true });
	await mkdir(distRoot, { recursive: true });
	const bunBuildCwd = await mkdtemp(join(tmpdir(), "interactor-bun-build-"));

	const checksums: string[] = [];
	const shaByLabel: Record<string, string> = {};

	try {
		for (const target of targets) {
			const targetDir = join(distRoot, target.label);
			const binaryPath = join(targetDir, target.binaryName);
			const archiveName = `interactor-${tag}-${target.label}.tar.gz`;
			const archivePath = join(distRoot, archiveName);

			await mkdir(targetDir, { recursive: true });

			await run(
				[
					"bun",
					"build",
					join(root, "src", "main.ts"),
					"--compile",
					"--minify",
					...bunBuildExternals,
					`--target=${target.bunTarget}`,
					`--outfile=${binaryPath}`,
				],
				bunBuildCwd,
			);

			await run(["chmod", "+x", binaryPath]);
			await run([
				"tar",
				"-C",
				targetDir,
				"-czf",
				archivePath,
				target.binaryName,
			]);

			const digest = await sha256(archivePath);
			if (!digest) throw new Error(`Empty checksum for ${archiveName}`);
			checksums.push(`${digest}  ${archiveName}`);
			shaByLabel[target.label] = digest;
		}
	} finally {
		await rm(bunBuildCwd, { recursive: true, force: true });
	}

	await writeFile(
		join(distRoot, "checksums.txt"),
		`${checksums.join("\n")}\n`,
		"utf8",
	);

	const formula = `class Interactor < Formula
  desc "Browser interactor CLI powered by Playwright"
  homepage "https://github.com/${repo}"
  version "${tag}"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/${repo}/releases/download/${tag}/interactor-${tag}-darwin-arm64.tar.gz"
      sha256 "${shaByLabel["darwin-arm64"] ?? "REPLACE_ME"}"
    else
      url "https://github.com/${repo}/releases/download/${tag}/interactor-${tag}-darwin-x64.tar.gz"
      sha256 "${shaByLabel["darwin-x64"] ?? "REPLACE_ME"}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/${repo}/releases/download/${tag}/interactor-${tag}-linux-arm64.tar.gz"
      sha256 "${shaByLabel["linux-arm64"] ?? "REPLACE_ME"}"
    else
      url "https://github.com/${repo}/releases/download/${tag}/interactor-${tag}-linux-x64.tar.gz"
      sha256 "${shaByLabel["linux-x64"] ?? "REPLACE_ME"}"
    end
  end

  depends_on "oven-sh/bun/bun"

  def install
    bin.install "interactor"
  end

  test do
    assert_match "No matching events found.", shell_output("#{bin}/interactor find definitely-not-an-event")
  end
end
`;

	await writeFile(formulaPath, formula, "utf8");
	console.log(`Built release artifacts for ${tag}`);
	console.log(`Artifacts directory: ${distRoot}`);
	console.log(`Generated formula artifact: ${formulaPath}`);
}

async function releaseExists(tag: string, repo?: string): Promise<boolean> {
	const command = ["gh", "release", "view", tag];
	if (repo) command.push("--repo", repo);
	const proc = Bun.spawn(command, {
		cwd: root,
		stdio: ["ignore", "ignore", "ignore"],
	});
	const code = await proc.exited;
	return code === 0;
}

function resolvePreviousTag(tags: string[], currentTag: string): string | undefined {
	const filtered = tags.filter(Boolean);
	const currentIndex = filtered.indexOf(currentTag);
	if (currentIndex >= 0) return filtered[currentIndex + 1];
	return filtered[0];
}

async function buildReleaseNotes(tag: string): Promise<string> {
	const tagsResult = await runCapture(["git", "tag", "--sort=-creatordate"]);
	if (tagsResult.code !== 0) {
		throw new Error(`Failed to list git tags: ${tagsResult.stderr || tagsResult.stdout}`);
	}

	const tags = tagsResult.stdout
		.split("\n")
		.map((value) => value.trim())
		.filter(Boolean);
	const previousTag = resolvePreviousTag(tags, tag);

	let logArgs: string[] = ["git", "log", "--pretty=format:- %h %s"];
	if (previousTag) {
		const currentExists = tags.includes(tag);
		const range = currentExists ? `${previousTag}..${tag}` : `${previousTag}..HEAD`;
		logArgs = [...logArgs, range];
	}

	const logResult = await runCapture(logArgs);
	if (logResult.code !== 0) {
		throw new Error(`Failed to build changelog: ${logResult.stderr || logResult.stdout}`);
	}

	const body = logResult.stdout.trim().length > 0 ? logResult.stdout.trim() : "- No changes found."
	const header = previousTag
		? `## Changelog (${previousTag} -> ${tag})`
		: `## Changelog (${tag})`;

	return `${header}\n\n${body}\n`;
}

async function hasStagedChanges(cwd: string): Promise<boolean> {
	const proc = Bun.spawn(["git", "diff", "--cached", "--quiet"], {
		cwd,
		stdio: ["ignore", "ignore", "ignore"],
	});
	const code = await proc.exited;
	return code === 1;
}

async function releaseAndTap(tag: string): Promise<void> {
	const repo = process.env.GITHUB_REPOSITORY ?? "vehmloewff/interactor";
	const tapRepo =
		process.env.HOMEBREW_TAP_REPO ??
		"git@github.com:vehmloewff/homebrew-tap.git";
	const tapBranch = process.env.HOMEBREW_TAP_BRANCH ?? "master";

	const assets = [
		`dist/interactor-${tag}-darwin-arm64.tar.gz`,
		`dist/interactor-${tag}-darwin-x64.tar.gz`,
		`dist/interactor-${tag}-linux-x64.tar.gz`,
		`dist/interactor-${tag}-linux-arm64.tar.gz`,
		`dist/interactor-${tag}-windows-x64.tar.gz`,
		"dist/checksums.txt",
	];
	const notes = await buildReleaseNotes(tag);
	const notesPath = join(distRoot, "release-notes.md");
	await writeFile(notesPath, notes, "utf8");

	if (await releaseExists(tag, repo)) {
		const edit = ["gh", "release", "edit", tag, "--notes-file", notesPath];
		if (repo) edit.push("--repo", repo);
		await run(edit);

		const upload = ["gh", "release", "upload", tag, ...assets, "--clobber"];
		if (repo) upload.push("--repo", repo);
		await run(upload);
		console.log(`Updated GitHub release ${tag}`);
	} else {
		const create = [
			"gh",
			"release",
			"create",
			tag,
			...assets,
			"--title",
			tag,
			"--notes-file",
			notesPath,
		];
		if (repo) create.push("--repo", repo);
		await run(create);
		console.log(`Created GitHub release ${tag}`);
	}

	const tapCloneDir = join(tmpdir(), `homebrew-tap-${Date.now()}`);
	await rm(tapCloneDir, { recursive: true, force: true });
	await run(["git", "clone", "--branch", tapBranch, tapRepo, tapCloneDir]);

	const formulaTargetDir = join(tapCloneDir, "Formula");
	const formulaTargetPath = join(formulaTargetDir, "interactor.rb");
	await mkdir(formulaTargetDir, { recursive: true });
	await copyFile(formulaPath, formulaTargetPath);
	await run(["git", "add", "Formula/interactor.rb"], tapCloneDir);

	if (!(await hasStagedChanges(tapCloneDir))) {
		console.log(
			`No Homebrew formula changes for ${tag}; skipping commit/push.`,
		);
		return;
	}

	await run(["git", "commit", "-m", `Interactor [${tag}]`], tapCloneDir);
	await run(["git", "push", "origin", tapBranch], tapCloneDir);
	console.log(
		`Updated Homebrew tap (${tapRepo}) with commit: Interactor [${tag}]`,
	);
}

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
	version: string;
};
const tag = resolveReleaseTag(process.env.RELEASE_VERSION ?? pkg.version);
const repoForFormula = process.env.GITHUB_REPOSITORY ?? "vehmloewff/interactor";

await buildArtifacts(tag, repoForFormula);
if (!noRelease) {
	await releaseAndTap(tag);
}
