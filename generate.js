import fse from "fs-extra";
import MarkdownIt from "markdown-it";
import prism from "markdown-it-prism";
import yamlFront from "yaml-front-matter";
import mustache from "mustache";
import html2plaintext from "html2plaintext";

const postsFolder = "posts";
const templatesFolder = "templates";
const stylesFolder = "styles";
const outputFolder = "gh-pages";

const markdownParser = new MarkdownIt({
    html: true,
    langPrefix: "language-",
    linkify: true,
    typographer: true,
});

markdownParser.use(prism);

const readFile = path => fse.readFile(path, "utf8");
const saveFile = (text, path) => fse.outputFile(path, text, { encoding: "utf8" });
const copyFile = (oldPath, newPath) => fse.copyFile(oldPath, newPath);
const copyFolder = (oldPath, newPath) => fse.copy(oldPath, newPath);

const parseMarkdownFile = text => {
    const frontMatter = yamlFront.loadFront(text);
    const markdownHTML = markdownParser.render(frontMatter.__content);
    
    return { frontMatter, markdownHTML };
}

const excerpt = text => html2plaintext(text).split(" ").slice(0, 30).join(" ")

const renderTemplate = ({ frontMatter, markdownHTML }, postTemplate) =>
    mustache.render(postTemplate, { ...frontMatter, markdownHTML });

const postOutputFile = file => file.replace(".md", ".html");
const postOutputPath = file => `${outputFolder}/posts/${postOutputFile(file)}`;

(async () => {
    const posts = fse.readdirSync(postsFolder);
    const postTemplate = await readFile(`${templatesFolder}/post.html`);

    // Clear the output directory
    let outputFolderContents;
    try {
        outputFolderContents = fse.readdirSync(outputFolder);
    } catch {}
    if (outputFolderContents) {
        await Promise.all(
            outputFolderContents
                .filter(file => file[0] != ".")
                .map(file => fse.remove(`${outputFolder}/${file}`))
        );
    }

    // Parse all the posts
    const postMarkdown = (await Promise.all(posts.map(file =>
        readFile(`${postsFolder}/${file}`)
            .then(text => ({ file, md: parseMarkdownFile(text) }))
    ))).reverse();

    await Promise.all(postMarkdown.map(({ file, md }) => {
        const html = renderTemplate(md, postTemplate);
        return saveFile(html, postOutputPath(file));
    }));

    // Create homepage with list of all posts
    const homepageTemplate = await readFile(`${templatesFolder}/home.html`)
    const homepage = mustache.render(homepageTemplate, {
        postExcerpts: postMarkdown.map(({ file, md }) => ({
            url: `/${postsFolder}/${postOutputFile(file)}`,
            excerpt: excerpt(md.markdownHTML),
            ...md.frontMatter,
        }))
    })
    await saveFile(homepage, `${outputFolder}/index.html`)


    // Write all the other necessary files
    await Promise.all([
        copyFolder(`${stylesFolder}`, `${outputFolder}/styles`),
    ]);
})();
