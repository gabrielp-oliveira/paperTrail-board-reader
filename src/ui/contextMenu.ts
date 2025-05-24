import { Dialog } from '../dialog/dialog.js';

export function showContextMenu( x: number,
  y: number,
  options: string[],
  chapterId: string) {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (!menu) return;

  menu.innerHTML = "";

  options.forEach(option => {
    const item = document.createElement("div");
    item.className = "context-menu-item";
    item.textContent = option;

    item.onclick = async () => {
      console.log("🔘 Opção selecionada:", option);

      // ⚠️ Garanta que o ID do template bate
      const template = document.getElementById("dialog-template") as HTMLTemplateElement | null;
      if (!template) {
        console.warn("⚠️ Template 'dialog-template' não encontrado.");
        hideContextMenu();
        return;
      }


      console.log(chapterId);
if (option === "details") {
  const template = document.getElementById("dialog-template") as HTMLTemplateElement;
  const contentNode = template.content.cloneNode(true) as HTMLElement;

        console.log(contentNode);

  Dialog.open({
    title: "Detalhes do Capítulo",
    content: contentNode,
    actions: [
      {
        label: "Fechar",
        action: () => Dialog.close()
      }
    ]
  });
}

      hideContextMenu();
    };

    menu.appendChild(item);
  });

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "block";
}

export function hideContextMenu() {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (menu) {
    menu.style.display = "none";
  }
}

document.addEventListener("click", () => hideContextMenu());


