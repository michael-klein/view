import { DirectiveType, getTextMarker, getAttributeMarker, } from "./html.js";
import { DOMUpdateType } from "./directive.js";
import { schedule, PriorityLevel } from "./scheduler.js";
const renderedNodesMap = new WeakMap();
export const clear = (container) => {
    if (renderedNodesMap.has(container)) {
        renderedNodesMap
            .get(container)
            .forEach(node => container.removeChild(node));
        renderedNodesMap.delete(container);
    }
};
const generatorMap = new WeakMap();
export const render = (container, htmlResult) => {
    let fragment;
    let init = false;
    if (!renderedNodesMap.has(container)) {
        init = true;
        const generators = [];
        generatorMap.set(container, generators);
        fragment = htmlResult.template.content.cloneNode(true);
        htmlResult.directives.forEach((directiveData, id) => {
            switch (directiveData.t) {
                case DirectiveType.TEXT:
                    const textMarker = getTextMarker(id);
                    const placeholder = fragment.querySelector(textMarker);
                    let textNode;
                    let isTextArea = false;
                    if (placeholder) {
                        textNode = placeholder.firstChild;
                    }
                    else {
                        isTextArea = true;
                        const textareas = fragment.querySelectorAll('textarea');
                        for (let i = 0; i < textareas.length; i++) {
                            const area = textareas[i];
                            if (area.innerText.includes(textMarker)) {
                                textNode = area.firstChild;
                                break;
                            }
                        }
                    }
                    generators[id] = directiveData.d.factory(textNode, ...directiveData.d.args);
                    if (!isTextArea) {
                        placeholder.parentNode.replaceChild(textNode, placeholder);
                    }
                    break;
                case DirectiveType.ATTRIBUTE:
                case DirectiveType.ATTRIBUTE_VALUE:
                    const marker = getAttributeMarker(id);
                    const node = fragment.querySelector(`[${marker}]`);
                    generators[id] = directiveData.d.factory(node, ...directiveData.d.args);
                    node.removeAttribute(marker);
            }
        });
        renderedNodesMap.set(container, Array.from(fragment.childNodes));
    }
    const generators = generatorMap.get(container);
    htmlResult.directives.forEach(async (directiveData, id) => {
        const result = generators[id].next(directiveData.d.args);
        if (result.value) {
            const domUpdate = await result.value;
            schedule(() => {
                domUpdate.forEach(d => {
                    switch (d.type) {
                        case DOMUpdateType.TEXT:
                            d.node.textContent = d.value;
                            break;
                        case DOMUpdateType.ADD_NODE:
                            d.node.appendChild(d.newNode);
                            break;
                        case DOMUpdateType.REPLACE_NODE:
                            d.node.parentNode.replaceChild(d.newNode, d.node);
                            break;
                        case DOMUpdateType.INSERT_BEFORE:
                            d.node.parentNode.insertBefore(d.newNode, d.node);
                            break;
                        case DOMUpdateType.REMOVE:
                            d.node.parentNode.removeChild(d.node);
                            break;
                        case DOMUpdateType.ADD_CLASS:
                            d.node.classList.add(d.value);
                            break;
                        case DOMUpdateType.REMOVE_CLASS:
                            d.node.classList.remove(d.value);
                            break;
                        case DOMUpdateType.SET_ATTRIBUTE:
                            d.node.setAttribute(d.name, d.value);
                            break;
                    }
                });
            }, init ? PriorityLevel.IMMEDIATE : undefined);
        }
    });
    if (fragment) {
        container.appendChild(fragment);
    }
};
//# sourceMappingURL=render.js.map