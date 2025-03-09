import { $, $$, addClass, clear, create, onClick, onInput, removeClass, setHTML } from "./util.js";

declare var MathJax: any;

// Default macros
const macros: { command: string, value: string }[] = [
    { command: "NN", value: "\\mathbb{N}" },
    { command: "QQ", value: "\\mathbb{Q}" },
    { command: "RR", value: "\\mathbb{R}" },
    { command: "CC", value: "\\mathbb{C}" },
];

// Default TeX snippets
const history: { tex: string }[] = [
    { tex: "a^2 + b^2 = c^2" },
    { tex: "\\NN \\subseteq \\QQ \\subseteq \\RR \\subseteq \\CC" },
    { tex: "\\begin{pmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{pmatrix}" },
];

document.addEventListener('DOMContentLoaded', function () {
    const textarea = $("textarea")! as HTMLTextAreaElement;

    // Load local data
    loadLocalData();

    // Event handlers
    onInput(textarea, renderSVG);
    onClick($("button-copy-svg")!, copySVG);
    onClick($("button-copy-png")!, copyPNG);
    onClick($("button-download-svg")!, downloadSVG);
    onClick($("button-download-png")!, downloadPNG);

    // Configure textarea
    configureTextarea(textarea);

    // Disable non-supported features
    if ('supports' in ClipboardItem && (ClipboardItem.supports as any)("image/svg+xml") === false) {
        const buttonCopySVG = $("button-copy-svg")!;
        addClass(buttonCopySVG, "disabled");
        buttonCopySVG.setAttribute("title", "This feature is not supported by your browser");
    }

    if ('supports' in ClipboardItem && (ClipboardItem.supports as any)("image/png") === false) {
        const buttonCopyPNG = $("button-copy-png")!;
        addClass(buttonCopyPNG, "disabled");
        buttonCopyPNG.setAttribute("title", "This feature is not supported by your browser");
    }

    // Macros
    updateMacrosOverview();
    onClick($("button-macros")!, () => {
        updateMacrosOverview();
        $("macros")!.classList.toggle("visible");
        $("history")!.classList.remove("visible");
    });

    // History
    updateHistoryOverview();
    onClick($("button-history")!, () => {
        updateHistoryOverview();
        $("history")!.classList.toggle("visible");
        $("macros")!.classList.remove("visible");
    });
});

window.onload = function () {
    // Initial render
    renderSVG();
}

function renderSVG() {
    const textarea = $("textarea")! as HTMLTextAreaElement;
    const output = $("output")! as HTMLDivElement;

    const tex = texFromMacros() + textarea.value;
    const options = {};
    
    MathJax.tex2svgPromise(tex, options).then(function (node: HTMLElement) {
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
        addHistoryEntry();
    } catch (err) {
        showError(`Failed to copy SVG (this feature is not supported by your browser)`);
    }
}

function downloadSVG() {
    const svg = $$("#output svg")[0] as unknown as SVGGraphicsElement;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = create("a", { href: url, target: "_blank", download: "equation.svg" });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addHistoryEntry();
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
                addHistoryEntry();
            } catch (err) {
                showError(`Failed to copy SVG: ${err}`);
            }
        });
    });
}

function downloadPNG() {
    renderPNG(canvas => {
        const link = create("a", { href: canvas.toDataURL(), target: "_blank", download: "equation.svg" });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addHistoryEntry();
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

function updateMacrosOverview(): void {
    const div = $("macros")!;
    clear(div);
    div.append(create("div", { class: "header" }, "macro"));
    div.append(create("div", { class: "header" }, "value"));
    for (const macro of macros) {
        div.append(create("div", {}, create("input", {
            value: macro.command,
            '@input': function () {
                if (this.value.match(/^[a-zA-Z]*$/)) {
                    removeClass(this as HTMLElement, "invalid");
                    macro.command = this.value;
                    renderSVG();
                }
                else {
                    addClass(this as HTMLElement, "invalid");
                }
            },
            "@change": storeLocalData,
        })));
        const textarea = create("textarea", {
            '@input': function () {
                macro.value = this.value;
                renderSVG();
            },
            "@change": storeLocalData,
        }, macro.value) as HTMLTextAreaElement;
        configureTextarea(textarea);
        div.append(create("div", {}, textarea));
    }
    div.append(create("div", {}, create("div", {
        id: "button-add-macro", '@click': function () {
            macros.push({ command: '', value: '' })
            updateMacrosOverview();
        }
    }, "+ macro")));
}

function texFromMacros(): string {
    let tex = '';
    for (const macro of macros) {
        if (macro.command != '') {
            let argc = 0;
            for (const match of macro.value.matchAll(/#\d+/g)) {
                const n = parseInt(match[0].substring(1));
                argc = Math.max(argc, n);
            }
            // TeX definition: `\def#1#2\mycommand{...}`
            tex += '\\def';
            tex += `\\${macro.command}`;
            for (let i = 1; i <= argc; ++i)
                tex += `#${i}`;
            tex += `{${macro.value}}\n`;
        }
    }
    return tex;
}

function updateHistoryOverview(): void {
    const div = $("history")!;
    clear(div);
    div.append(create("div", { class: "header" }, "history"));
    for (const entry of history) {
        div.append(create("div", {
            class: "entry", "@click": () => {
                const textarea = $("textarea")! as HTMLTextAreaElement;
                textarea.value = entry.tex;
                textarea.style.height = "auto";
                textarea.style.height = `${textarea.scrollHeight}px`;
                renderSVG();
            }
        }, entry.tex));
        div.append(create("div", {
            class: "button-delete", "@click": () => {
                history.splice(history.indexOf(entry), 1);
                updateHistoryOverview();
                storeLocalData();
            }
        }));
    }
}

function addHistoryEntry(): void {
    const textarea = $("textarea")! as HTMLTextAreaElement;
    const tex = textarea.value;
    if (history.some(entry => entry.tex == tex)) {
        return;
    }
    history.unshift({ tex });
    updateHistoryOverview();
    storeLocalData();
}

function configureTextarea(textarea: HTMLTextAreaElement): void {
    textarea.rows = 1;
    const update = () => {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    };
    onInput(textarea, update);
    update();
    setTimeout(update, 1);
    setTimeout(update, 10);
    setTimeout(update, 100);
    textarea.addEventListener('keydown', function (event) {
        if (event.key == 'Tab') {
            event.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const tab = "    ";
            this.value = this.value.substring(0, start) + tab + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + tab.length;
        }
    });
}

function storeLocalData(): void {
    localStorage.setItem("tex-to-img-macros", JSON.stringify(macros.filter(macro => macro.command != '')));
    localStorage.setItem("tex-to-img-history", JSON.stringify(history));
}

function loadLocalData(): void {
    const localMacros = localStorage.getItem("tex-to-img-macros");
    const localHistory = localStorage.getItem("tex-to-img-history");

    if (localMacros != null) {
        macros.length = 0;
        macros.push(...JSON.parse(localMacros));
    }

    if (localHistory != null) {
        history.length = 0;
        history.push(...JSON.parse(localHistory));
    }
}
