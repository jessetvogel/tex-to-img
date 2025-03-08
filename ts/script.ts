import { $, $$, addClass, clear, create, onClick, onInput } from "./util.js";

declare var MathJax: any;

document.addEventListener('DOMContentLoaded', function () {
    const textarea = $("textarea")! as HTMLTextAreaElement;

    // Event handlers
    onInput(textarea, renderSVG);
    onClick($("button-copy-svg")!, copySVG);
    onClick($("button-copy-png")!, copyPNG);
    onClick($("button-download-svg")!, downloadSVG);
    onClick($("button-download-png")!, downloadPNG);

    // 'Tab' event
    textarea.addEventListener('keydown', function (event) {
        if (event.key == 'Tab') {
            event.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;

            // set textarea value to: text before caret + tab + text after caret
            const tab = "    ";
            this.value = this.value.substring(0, start) + tab + this.value.substring(end);

            // put caret at right position again
            this.selectionStart =
                this.selectionEnd = start + tab.length;
        }
    });

    // Grow textarea size to initial input
    (textarea.parentNode as any).dataset.replicatedValue = textarea.value;

    // Disable non-supported features
    if ('supports' in ClipboardItem && ClipboardItem.supports("image/svg+xml") === false) {
        const buttonCopySVG = $("button-copy-svg")!;
        addClass(buttonCopySVG, "disabled");
        buttonCopySVG.setAttribute("title", "This feature is not supported by your browser");
    }

    if ('supports' in ClipboardItem && ClipboardItem.supports("image/png") === false) {
        const buttonCopyPNG = $("button-copy-png")!;
        addClass(buttonCopyPNG, "disabled");
        buttonCopyPNG.setAttribute("title", "This feature is not supported by your browser");
    }
});

window.onload = function () {
    // Initial render
    renderSVG();
}

function renderSVG() {
    const textarea = $("textarea")! as HTMLTextAreaElement;
    const output = $("output")! as HTMLDivElement;

    const options = {};
    MathJax.tex2svgPromise(textarea.value, options).then(function (node: HTMLElement) {
        clear(output);
        output.append(node);
    }).catch(function (err: any) {
        showError(`Failed to compile TeX: ${err}`);
    });
}

async function copySVG() {
    if (!navigator.clipboard) {
        console.error("Clipboard API not supported");
        return;
    }

    const svg = $$("#output svg")[0];
    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const item = new ClipboardItem({ "image/svg+xml": blob });

    try {
        await navigator.clipboard.write([item]);
        showMessage("Copied SVG to clipboard !");
    } catch (err) {
        showError(`Failed to copy SVG (this feature is not supported by your browser)`);
    }
}

function renderPNG(callback: (canvas: HTMLCanvasElement) => void): void {
    const svg = $$("#output svg")[0] as unknown as SVGGraphicsElement;
    const canvas = $('canvas')! as HTMLCanvasElement;

    const svgWidth = svg.clientWidth;
    const svgHeight = svg.clientHeight;
    const xml = new XMLSerializer().serializeToString(svg);
    const image64 = 'data:image/svg+xml;base64,' + btoa(xml);

    const img = new Image();
    img.onload = function () {
        const scale = 8.0;
        const width = scale * svgWidth;
        const height = scale * svgHeight;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        callback(canvas);
    }
    img.src = image64;
}

function copyPNG() {
    renderPNG(canvas => {
        canvas.toBlob(async function (blob) {
            const item = new ClipboardItem({ "image/png": blob! });
            try {
                await navigator.clipboard.write([item]);
                showMessage("Copied PNG to clipboard !");
            } catch (err) {
                showError(`Failed to copy SVG: ${err}`);
            }
        });
    });
}

function downloadSVG() {
    const svg = $$("#output svg")[0] as unknown as SVGGraphicsElement;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = create("a", { href: url, target: "_blank", download: "equation.svg" });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadPNG() {
    renderPNG(canvas => {
        const link = create("a", { href: canvas.toDataURL(), target: "_blank", download: "equation.svg" });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

function showMessage(msg: string): void {
    const messages = $("messages")!;
    const message = create("div", {}, msg);
    clear(messages);
    messages.append(message);
}

function showError(msg: string): void {
    const messages = $("messages")!;
    const message = create("div", { class: "error" }, msg);
    clear(messages);
    messages.append(message);
}

(window as any).message = showMessage;