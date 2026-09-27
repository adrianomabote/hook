import originalHtml from "./current.html?raw";
import originalStyles from "./_group.css?raw";

const currentPage = originalHtml
  .replace(/<link rel="icon"[^>]*>\s*/i, "")
  .replace(/<link rel="stylesheet" href="\/styles\.css">\s*/i, "")
  .replace(/<script src="\/app\.js" defer><\/script>\s*/i, "")
  .replace("</head>", `<style>${originalStyles}</style>\n  </head>`);

export function Current() {
  return (
    <iframe
      title="ContactoCheck — página atual"
      srcDoc={currentPage}
      style={{ display: "block", width: "100%", height: "100vh", border: 0 }}
    />
  );
}