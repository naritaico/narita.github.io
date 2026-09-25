# Narita Reyes Ico

Personal portfolio website

Live site: https://www.naritareyesico.com

## About

Static portfolio website built with Jekyll and hosted on GitHub Pages.

The site includes:

- Home page, featuring highlighted projects
- Archives list
- Individual project pages
- About page
- CV page
- Contact page

## Stack

- **Jekyll**
- **Pages CMS**
- **GitHub Pages**
- **GitHub Actions** (see "Image processing")

## Structure

```
.
├── _projects/                        # one file per project
│                                       # edit only via Pages CMS
├── _layouts/
│   ├── default.html                  # shared page frame (header, nav, footer)
│   ├── project-default.html          # text + image(s) project layout
│   └── project-text.html             # text-only project layout
├── assets/
│   ├── images/
│   │   ├── project-images/           # processed project images
│   │   │   └── <project-name>/       # one folder per project
│   │   │       ├── image-01.webp
│   │   │       └── image-02.webp
│   │   └── uploads/                  # staging folder for new CMS uploads
│   │                                   # auto-processed, don't add files here manually
│   └── css/
│       └── style.css
│
├── .github/
│   └── workflows/
│       └── process-images.yml        # runs the image-processing script
├── scripts/
│   └── process-images.js             # converts/resizes/renames project images
├── .pages.yml                        # Pages CMS config (form fields)
└── _config.yml
```

## Image processing

This is done through GitHub Actions, scripts were vibe-coded.
It runs every time a project is saved on Pages CMS.

**Steps**

1. Convert new uploads to webp and resize anything over 2000px wide
2. Rename images to \`image-01\`, \`image-02\`... in the order set in the CMS
3. Delete images/folders for projects that get removed

Check the **Actions** tab on GitHub if a save doesn't seem to have worked,
a red X there means something failed and nothing was published.

## Adding a project

Adding projects is done through the Pages CMS interface.
