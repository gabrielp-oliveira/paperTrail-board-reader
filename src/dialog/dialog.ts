export class Dialog {
  static open(options: { title: string; content: Node; actions?: { label: string; action: () => void }[] }) {
    const dialog = document.getElementById("dialog")!;
    const title = document.getElementById("dialog-title")!;
    const body = document.getElementById("dialog-body")!;
    const closeBtn = document.getElementById("dialog-close")!;

    // Limpa conteúdo anterior
    title.textContent = options.title;
    body.innerHTML = "";
    body.appendChild(options.content);

    // Mostra o diálogo
    dialog.classList.remove("hidden");

    // Ação padrão de fechar
    closeBtn.onclick = () => Dialog.close();

    // Se houver ações customizadas
    if (options.actions) {
      const actionsContainer = dialog.querySelector(".dialog-actions")!;
      actionsContainer.innerHTML = ""; // limpa botões anteriores

      options.actions.forEach(action => {
        const btn = document.createElement("button");
        btn.textContent = action.label;
        btn.onclick = () => {
          action.action();
        };
        actionsContainer.appendChild(btn);
      });
    }
  }

  static close() {
    const dialog = document.getElementById("dialog")!;
    dialog.classList.add("hidden");
  }
}
