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

    item.onclick = () => {
      window.parent.postMessage(
        {
          type: "chapter-option-selected",
          data: {
            chapterId,
            option
          }
        },
        "*"
      );
      hideContextMenu();
    };

    // Padding proporcional ao zoom
    item.style.padding = `${6 / zoomScale}px ${12 / zoomScale}px`;
    menu.appendChild(item);
  });

  // Posiciona o menu
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "block";

  // Escala visual do menu
  menu.style.setProperty("--scale", `${zoomScale}`);
  menu.style.fontSize = `${14 / zoomScale}px`;

  // ✅ Fecha ao clicar fora
  setTimeout(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#context-menu")) {
        hideContextMenu();
        document.removeEventListener("click", handleOutsideClick);
      }
    };
    document.addEventListener("click", handleOutsideClick);
  });

  // ✅ Fecha com ESC
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      hideContextMenu();
      document.removeEventListener("keydown", handleKey);
    }
  };
  document.addEventListener("keydown", handleKey);
}

export function hideContextMenu() {
  const menu = document.getElementById("context-menu") as HTMLDivElement;
  if (menu) {
    menu.style.display = "none";
  }
}
