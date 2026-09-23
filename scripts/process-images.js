const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const YAML = require("yaml");

// ---------- SETTINGS (change these if needed) ----------
const PROJECTS_DIR = "_projects";
const UPLOADS_DIR = "assets/images/uploads";
const OUTPUT_DIR = "assets/images/project-images";
const UPLOADS_URL = "/assets/images/uploads/";
const OUTPUT_URL = "/assets/images/project-images/";
const MAX_WIDTH = 2000; // images wider than this (in pixels) get shrunk
const QUALITY = 80; // webp quality, 1-100
// --------------------------------------------------------

// Converts a project filename into a URL-safe folder name,
// e.g. "My Project.md" becomes "my-project".
function slugify(name) {
	return name
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{Nd}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

// Splits a project file into the front matter (between the --- lines)
// and the body (everything after).
function splitFrontMatter(text) {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return null;
	return { frontMatter: match[1], body: match[2] };
}

async function processProject(file, slug, uploadsToDelete) {
	const projectPath = path.join(PROJECTS_DIR, file);
	const parts = splitFrontMatter(fs.readFileSync(projectPath, "utf8"));
	if (!parts) return;

	const doc = YAML.parseDocument(parts.frontMatter);
	const data = doc.toJS() || {};
	const images = Array.isArray(data.images)
		? data.images
		: data.images
			? [data.images]
			: [];
	const folder = path.join(OUTPUT_DIR, slug);

	// No images listed: remove the project's image folder if it exists.
	if (images.length === 0) {
		fs.rmSync(folder, { recursive: true, force: true });
		return;
	}

	// Check everything BEFORE changing any files. Any problem stops the run.
	if (!images.every((url) => typeof url === "string")) {
		throw new Error(`${file}: the images list must contain only file paths`);
	}

	const entries = images.map((url) => {
		let source;
		let isNew = false;
		if (url.startsWith(UPLOADS_URL)) {
			source = path.join(UPLOADS_DIR, path.basename(url));
			isNew = true;
		} else if (url.startsWith(OUTPUT_URL)) {
			source = url.slice(1); // drop the leading slash
		} else {
			throw new Error(`${file}: unsupported image path: ${url}`);
		}
		if (!fs.existsSync(source)) {
			throw new Error(`${file}: image file not found: ${url}`);
		}
		return { url, source, isNew };
	});

	fs.mkdirSync(folder, { recursive: true });

	// Step 1: write every image to a temporary name, in list order.
	let count = 0;
	for (const entry of entries) {
		count++;
		entry.tmp = path.join(folder, `.tmp-${count}.webp`);
		if (entry.isNew) {
			await sharp(entry.source)
				.rotate() // apply the photo's rotation, since webp drops it
				.resize({ width: MAX_WIDTH, withoutEnlargement: true })
				.webp({ quality: QUALITY })
				.toFile(entry.tmp);
		} else {
			fs.copyFileSync(entry.source, entry.tmp); // already processed
		}
	}

	// Step 2: delete everything else in the folder (old names, removed images).
	for (const name of fs.readdirSync(folder)) {
		if (!name.startsWith(".tmp-")) {
			fs.rmSync(path.join(folder, name), { recursive: true, force: true });
		}
	}

	// Step 3: rename the temporary files to image-01.webp, image-02.webp, ...
	count = 0;
	const newImages = entries.map((entry) => {
		count++;
		const name = `image-${String(count).padStart(2, "0")}.webp`;
		fs.renameSync(entry.tmp, path.join(folder, name));
		return `${OUTPUT_URL}${slug}/${name}`;
	});

	// Step 4: remember which staging uploads to delete once everything is done.
	for (const entry of entries) {
		if (entry.isNew) uploadsToDelete.add(entry.source);
	}

	// Step 5: update the images list in the project file, only if it changed.
	if (JSON.stringify(newImages) !== JSON.stringify(images)) {
		doc.set("images", newImages);
		const newFrontMatter = doc.toString({ lineWidth: 0 });
		fs.writeFileSync(projectPath, `---\n${newFrontMatter}---\n${parts.body}`);
		console.log(`  updated ${file}: ${newImages.length} image(s)`);
	}
}

async function main() {
	if (!fs.existsSync(PROJECTS_DIR)) {
		console.error(`Cannot find ${PROJECTS_DIR}, stopping.`);
		process.exit(1);
	}

	const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith(".md"));
	const slugs = new Set();
	const uploadsToDelete = new Set();

	for (const file of files) {
		const slug = slugify(path.basename(file, ".md"));
		if (slugs.has(slug)) {
			throw new Error(
				`${file}: another project file produces the same folder name "${slug}"`,
			);
		}
		slugs.add(slug);
		console.log(`Processing ${file}`);
		await processProject(file, slug, uploadsToDelete);
	}

	// Delete image folders that no longer have a matching project file.
	if (fs.existsSync(OUTPUT_DIR)) {
		for (const entry of fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })) {
			if (entry.isDirectory() && !slugs.has(entry.name)) {
				console.log(`Removing images for deleted project: ${entry.name}`);
				fs.rmSync(path.join(OUTPUT_DIR, entry.name), {
					recursive: true,
					force: true,
				});
			}
		}
	}

	// Last step: delete the staging uploads that were processed.
	for (const upload of uploadsToDelete) {
		fs.rmSync(upload, { force: true });
	}

	console.log("Done.");
}

main().catch((err) => {
	console.error(err.message || err);
	process.exit(1);
});
