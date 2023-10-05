import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import execa from 'execa';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as tc from '@actions/tool-cache';

export const WINDOWS = process.platform === 'win32';

export function getProtoHome() {
	if (process.env.PROTO_HOME) {
		return process.env.PROTO_HOME;
	}

	return path.join(os.homedir(), '.proto');
}

export function getBinDir() {
	return path.join(getProtoHome(), 'bin');
}

export function getPluginsDir() {
	return path.join(getProtoHome(), 'plugins');
}

export function getToolsDir() {
	return path.join(getProtoHome(), 'tools');
}

export function getWorkingDir() {
	return process.env.GITHUB_WORKSPACE ?? process.cwd();
}

export function isUsingMoon() {
	return fs.existsSync(path.join(getWorkingDir(), core.getInput('workspace-root'), '.moon'));
}

export async function getToolchainCacheKey() {
	const files = ['**/.prototools'];

	if (isUsingMoon()) {
		files.push(path.join(core.getInput('workspace-root'), '.moon/toolchain.yml'));
	}

	const toolchainHash = await glob.hashFiles(files.join('\n'));

	return `moonrepo-toolchain-${process.platform}-${toolchainHash}`;
}

export async function installBin(bin: string) {
	core.info(`Installing \`${bin}\` globally`);

	const version = core.getInput(`${bin}-version`) || 'latest';

	const scriptName = WINDOWS ? `${bin}.ps1` : `${bin}.sh`;
	const scriptPath = path.join(getProtoHome(), 'temp', scriptName);

	// If the installer already exists, delete it and ensure were using the latest
	if (fs.existsSync(scriptPath)) {
		fs.unlinkSync(scriptPath);
	}

	core.info('Downloading installation script');

	const script = await tc.downloadTool(`https://moonrepo.dev/install/${scriptName}`, scriptPath);

	// eslint-disable-next-line no-magic-numbers
	await fs.promises.chmod(script, 0o755);

	core.info(`Downloaded script to ${script}`);

	core.info('Executing installation script');

	const binDir = getBinDir();
	const binPath = path.join(binDir, WINDOWS ? `${bin}.exe` : bin);

	await execa(script, version === 'latest' ? [] : [version], {
		env: {
			[`${bin.toUpperCase()}_INSTALL_DIR`]: binDir,
		},
		stdio: core.isDebug() || !!process.env[`${bin.toUpperCase()}_DEBUG`] ? 'inherit' : 'pipe',
	});

	core.info(`Installed binary to ${binPath}`);
}
