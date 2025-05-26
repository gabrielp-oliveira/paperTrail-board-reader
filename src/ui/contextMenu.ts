export function showContextMenu(
  x: number,
  y: number,
  options: string[],
  chapterId: string,
  zoomScale: number = 1
) {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (!menu) return;

  // 🧼 Limpa o conteúdo anterior
  menu.innerHTML = "";

  // 🔁 Cria opções dinamicamente
  options.forEach(option => {
    const item = document.createElement("div");
    item.className = "context-menu-item";
    item.textContent = option;

    // Clique em uma das opções
    item.onclick = async () => {
      // Envia para o app pai
      window.parent.postMessage(
        {
          type: "chapter-option-selected",
          chapterId,
          option
        },
        "*"
      );

      hideContextMenu();
    };

    // Aplica padding proporcional ao zoom
    item.style.padding = `${6 / zoomScale}px ${12 / zoomScale}px`;

    menu.appendChild(item);
  });

  // Posiciona o menu
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "block";

  // Aplica escala visual ao menu com CSS variable
  menu.style.setProperty("--scale", `${zoomScale}`);

  // Font-size proporcional
  const baseFontSize = 14;
  menu.style.fontSize = `${baseFontSize / zoomScale}px`;
}

export function hideContextMenu() {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (menu) {
    menu.style.display = "none";
  }
}


