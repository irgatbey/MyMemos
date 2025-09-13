"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // === DOM ELEMENTLERİ ===
  const appContainer = document.querySelector(".app-container");
  const contentContainer = document.getElementById("contentContainer");
  const headerTitle = document.getElementById("headerTitle");
  const addBtn = document.getElementById("addBtn");
  const addFolderBtn = document.getElementById("addFolderBtn");
  const addColumnBtn = document.getElementById("addColumnBtn");
  const dialogs = {
    note: document.getElementById("noteDialog"),
    task: document.getElementById("taskDialog"),
    column: document.getElementById("columnDialog"),
    confirm: document.getElementById("confirmDialog"),
    viewTask: document.getElementById("viewTaskDialog"),
    viewNote: document.getElementById("viewNoteDialog"),
    folder: document.getElementById("folderDialog"),
    folderView: document.getElementById("folderViewDialog"),
  };
  const forms = {
    note: document.getElementById("noteForm"),
    task: document.getElementById("taskForm"),
    column: document.getElementById("columnForm"),
    folder: document.getElementById("folderForm"),
  };
  const confirmDialogMessage = document.getElementById("confirmDialogMessage");
  const confirmDialogCancelBtn = document.getElementById(
    "confirmDialogCancelBtn"
  );
  const confirmDialogConfirmBtn = document.getElementById(
    "confirmDialogConfirmBtn"
  );

  // === UYGULAMA DURUMU (STATE) ===
  let state = {
    currentView: "notes",
    searchTerm: "",
    notes: [],
    archivedNotes: [],
    folders: [],
    kanban: { columns: [], tasks: [], archivedTasks: [] },
    editingNoteId: null,
    editingFolderId: null,
    editingTaskId: null,
    editingColumnId: null,
    viewingFolderId: null,
  };

  // === VERİ YÖNETİMİ ===
  function loadData() {
    state.notes = JSON.parse(localStorage.getItem("MyMemos_notes")) ?? [];
    state.archivedNotes =
      JSON.parse(localStorage.getItem("MyMemos_archivedNotes")) ?? [];
    state.folders = JSON.parse(localStorage.getItem("MyMemos_folders")) ?? [];

    state.kanban = JSON.parse(localStorage.getItem("MyMemos_kanbanData")) ?? {};
    state.kanban.columns = state.kanban.columns || [];
    state.kanban.tasks = state.kanban.tasks || [];
    state.kanban.tasks = state.kanban.tasks.map((task) => ({
      ...task,
      subtasks: task.subtasks || [],
    }));
    state.kanban.archivedTasks = state.kanban.archivedTasks || [];
    state.kanban.archivedTasks = state.kanban.archivedTasks.map((task) => ({
      ...task,
      subtasks: task.subtasks || [],
    }));

    const isSidebarCollapsed =
      localStorage.getItem("sidebarCollapsed") ?? "true";
    if (isSidebarCollapsed === "true") {
      appContainer.classList.add("sidebar-collapsed");
    }
    localStorage.setItem("sidebarCollapsed", isSidebarCollapsed);

    const savedTheme = localStorage.getItem("MyMemos_theme") || "dark";
    document.body.className = savedTheme === "light" ? "light-theme" : "";
  }

  function saveData(type) {
    const dataMap = {
      notes: { key: "MyMemos_notes", data: state.notes },
      archivedNotes: {
        key: "MyMemos_archivedNotes",
        data: state.archivedNotes,
      },
      folders: { key: "MyMemos_folders", data: state.folders },
      kanban: { key: "MyMemos_kanbanData", data: state.kanban },
    };
    if (dataMap[type]) {
      localStorage.setItem(
        dataMap[type].key,
        JSON.stringify(dataMap[type].data)
      );
    }
  }

  // === ANA RENDER FONKSİYONU ===
  function render() {
    const view = state.currentView;
    const headerActions = document.querySelector(".header-actions");
    const clearArchiveBtn = document.getElementById("clearArchiveBtn"); // EKLENDİ

    switch (view) {
      case "notes":
        headerTitle.textContent = "Notlarım";
        renderNotesView();
        break;
      case "kanban":
        headerTitle.textContent = "Yapılacaklar Panosu";
        renderKanbanBoard();
        break;
      case "archive":
        headerTitle.textContent = "Arşiv";
        renderArchiveView();
        break;
    }

    contentContainer.className =
      view === "kanban" ? "kanban-board" : "notes-grid";
    headerActions.style.display = "flex";

    // Hide folder button in kanban view
    addFolderBtn.style.display = view === "notes" ? "block" : "none";
    // Show search only in notes view
    document.getElementById("searchBtn").style.display =
      view === "notes" ? "flex" : "none";
    // Show column button only in kanban view
    addColumnBtn.style.display = view === "kanban" ? "block" : "none";

    if (view === "notes") {
      addBtn.style.display = "block";
      addBtn.textContent = "+ Yeni Not Ekle";
    } else if (view === "kanban") {
      addBtn.style.display = state.kanban.columns.length > 0 ? "block" : "none";
      addBtn.textContent = "+ Yeni Görev Ekle";
    } else {
      addBtn.style.display = "none";
    }

    // Arşivdeyse butonu göster, diğerlerinde gizle
    clearArchiveBtn.style.display = view === "archive" ? "block" : "none";
  }

  // === GÖRÜNÜM DEĞİŞTİRME ===
  function switchView(view) {
    state.currentView = view;
    document
      .querySelectorAll(".nav-btn")
      .forEach((btn) => btn.classList.remove("active"));
    const viewButtonMap = {
      notes: "showNotesBtn",
      kanban: "showTodosBtn",
      archive: "showArchiveBtn",
    };
    document.getElementById(viewButtonMap[view]).classList.add("active");
    render();
  }

  // === GÖRÜNÜM OLUŞTURMA FONKSİYONLARI ===
  function renderNotesView() {
    const foldersHtml = state.folders
      .map((folder) => getFolderHtml(folder))
      .join("");
    const rootNotes = state.notes.filter((note) => !note.folderId);
    const notesHtml = rootNotes
      .map((note) => getNoteHtml(note, false))
      .join("");
    contentContainer.innerHTML = foldersHtml + notesHtml;
    contentContainer.classList.toggle("is-empty", !foldersHtml && !notesHtml);
    if (!foldersHtml && !notesHtml) {
      contentContainer.innerHTML = `<div class="empty-state"><h2>Henüz not veya klasör yok</h2><p>Hemen bir not veya klasör ekleyin!</p></div>`;
    }
  }

  function renderKanbanBoard() {
    if (state.kanban.columns.length === 0) {
      contentContainer.innerHTML = `<div class="empty-state"><h2>Henüz kolon yok</h2><p>Başlamak için yeni bir kolon ekleyin!</p></div>`;
      return;
    }
    contentContainer.innerHTML = "";
    const tasksByColumn = state.kanban.tasks.reduce((acc, task) => {
      (acc[task.columnId] = acc[task.columnId] || []).push(task);
      return acc;
    }, {});

    state.kanban.columns.forEach((column) => {
      const columnEl = document.createElement("div");
      columnEl.className = "kanban-column";
      columnEl.dataset.columnId = column.id;
      columnEl.innerHTML = getColumnHtml(column);
      const taskListEl = columnEl.querySelector(".task-list");
      const tasksInColumn = tasksByColumn[column.id] || [];
      const tasksHtml = tasksInColumn
        .map((task, index) =>
          getTaskHtml(
            task,
            false,
            index === 0,
            index === tasksInColumn.length - 1
          )
        )
        .join("");
      taskListEl.innerHTML = tasksHtml;
      contentContainer.appendChild(columnEl);
    });
  }

  function renderArchiveView() {
    const archivedNotesHtml = state.archivedNotes
      .map((note) => getNoteHtml(note, true))
      .join("");
    const archivedTasksHtml = state.kanban.archivedTasks
      .map((task) => getTaskHtml(task, true))
      .join("");
    const finalHtml = archivedNotesHtml + archivedTasksHtml;

    if (finalHtml) {
      contentContainer.innerHTML = finalHtml;
      contentContainer.classList.remove("is-empty");
    } else {
      contentContainer.innerHTML = `<div class="empty-state"><h2>Arşiv boş</h2><p>Arşivlenmiş bir not veya görev bulunmuyor.</p></div>`;
      contentContainer.classList.add("is-empty");
    }
  }

  function renderFolderContents(folderId) {
    const notesInFolder = state.notes.filter(
      (note) => note.folderId === folderId
    );
    const folderContentEl =
      dialogs.folderView.querySelector("#folderViewContent");
    folderContentEl.innerHTML =
      notesInFolder.length > 0
        ? notesInFolder.map((note) => getNoteHtml(note, false)).join("")
        : `<div class="empty-state"><h2>Bu klasör boş</h2></div>`;
  }

  // === HTML OLUŞTURMA YARDIMCILARI ===
  function getFolderHtml(folder) {
    return `<div class="folder-card" data-folder-id="${
      folder.id
    }" data-action="open-folder" style="border-left-color: ${
      folder.color ?? "var(--border-color)"
    };"><div class="folder-icon"><svg width="24" height="24" fill="currentColor"><use href="#icon-folder"></use></svg></div><span class="folder-name">${
      folder.name
    }</span><div class="folder-actions"><button class="edit-btn" data-action="edit-folder" title="Klasörü Düzenle"><svg width="20" height="20" fill="currentColor"><use href="#icon-edit"></use></svg></button><button class="delete-btn" data-action="delete-folder" title="Klasörü Sil"><svg width="20" height="20" fill="currentColor"><use href="#icon-trash"></use></svg></button></div></div>`;
  }

  function getNoteHtml(note, isArchived) {
    const style = note.color ? `style="background-color: ${note.color};"` : "";
    let textClass = "";
    if (note.color) {
      textClass = isColorLight(note.color)
        ? "card-has-light-bg"
        : "card-has-dark-bg";
    }
    let actionsHtml;

    if (isArchived) {
      actionsHtml = `
            <button class="restore-btn" data-action="restore-note" title="Notu Geri Yükle"><svg width="20" height="20" fill="currentColor"><use href="#icon-restore"></use></svg></button>
            <button class="delete-btn" data-action="delete-note-permanently" title="Kalıcı Olarak Sil"><svg width="20" height="20" fill="currentColor"><use href="#icon-trash"></use></svg></button>
        `;
    } else {
      const moveToRootBtnHtml = note.folderId
        ? `<button class="edit-btn" data-action="move-note-to-root" title="Ana Dizine Taşı"><svg width="20" height="20" fill="currentColor"><use href="#icon-move-to-root"></use></svg></button>`
        : "";
      actionsHtml = `
            ${moveToRootBtnHtml}
            <button class="edit-btn" data-action="edit-note" title="Notu Düzenle"><svg width="20" height="20" fill="currentColor"><use href="#icon-edit"></use></svg></button>
            <button class="delete-btn" data-action="archive-note" title="Notu Arşivle"><svg width="20" height="20" fill="currentColor"><use href="#icon-archive"></use></svg></button>
        `;
    }

    return `
    <div class="note-card ${textClass}" data-note-id="${note.id}" ${style} data-action="view-note">
      <h3 class="note-title">${note.title}</h3>
      <p class="note-content">${note.content}</p>
      <div class="note-actions">${actionsHtml}</div>
    </div>`;
  }

  function getTaskHtml(task, isArchived, isFirst = false, isLast = false) {
    const style = task.color ? `style="background-color: ${task.color};"` : "";
    let textClass = "";
    if (task.color) {
      textClass = isColorLight(task.color)
        ? "card-has-light-bg"
        : "card-has-dark-bg";
    }
    let footerHtml;
    let progressHtml = "";

    if (task.subtasks && task.subtasks.length > 0) {
      const totalCount = task.subtasks.length;
      const completedCount = task.subtasks.filter((st) => st.completed).length;
      const progressPercent =
        totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
      progressHtml = `
        <div class="subtask-progress-container">
            <span class="subtask-progress-label">${completedCount}/${totalCount} ALT GÖREV TAMAMLANDI</span>
            <div class="subtask-progress-bar">
                <div class="subtask-progress-bar-inner" style="width: ${progressPercent}%;"></div>
            </div>
        </div>`;
    }

    if (isArchived) {
      footerHtml = `
        <div class="task-card-footer">
             <div class="task-actions" style="margin-left: auto;">
                <button class="restore-btn" data-action="restore-task" title="Görevi Geri Yükle"><svg width="18" height="18" fill="currentColor"><use href="#icon-restore"></use></svg></button>
                <button class="delete-btn" data-action="delete-task-permanently" title="Kalıcı Olarak Sil"><svg width="18" height="18" fill="currentColor"><use href="#icon-trash"></use></svg></button>
             </div>
        </div>`;
    } else {
      let reminderHtml = "";
      if (task.date) {
        const formattedDate = new Date(task.date).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const timeHtml = task.time
          ? `<svg width="14" height="14" fill="currentColor" style="margin-left: 8px;"><use href="#icon-clock"></use></svg>${task.time}`
          : "";
        reminderHtml = `<div class="task-reminder"><svg width="14" height="14" fill="currentColor"><use href="#icon-calendar"></use></svg>${formattedDate} ${timeHtml}</div>`;
      }
      footerHtml = `
        <div class="task-card-footer">
            ${reminderHtml}
            <button class="complete-btn" data-action="toggle-complete" title="Tamamlandı olarak işaretle"><svg width="18" height="18" fill="currentColor"><use href="#icon-check"></use></svg></button>
            <div class="task-actions">
              <button class="edit-btn" data-action="move-task-up" title="Yukarı Taşı" ${
                isFirst ? "disabled" : ""
              }><svg width="24" height="24" fill="currentColor"><use href="#icon-arrow-up"></use></svg></button>
              <button class="edit-btn" data-action="move-task-down" title="Aşağı Taşı" ${
                isLast ? "disabled" : ""
              }><svg width="24" height="24" fill="currentColor"><use href="#icon-arrow-down"></use></svg></button>
              <button class="edit-btn" data-action="edit-task" title="Görevi Düzenle"><svg width="18" height="18" fill="currentColor"><use href="#icon-edit"></use></svg></button>
              <button class="delete-btn" data-action="archive-task" title="Görevi Arşivle"><svg width="18" height="18" fill="currentColor"><use href="#icon-archive"></use></svg></button>
            </div>
        </div>`;
    }

    return `
    <div class="task-card ${textClass} ${
      task.completed ? "is-completed" : ""
    }" data-task-id="${task.id}" ${style} data-action="view-task">
        <div class="task-card-content">
            <span class="task-title">${task.title}</span>
            ${progressHtml} 
            <p class="task-content">${task.content}</p>
        </div>
        ${footerHtml}
    </div>`;
  }

  function getColumnHtml(column) {
    return `<div class="column-title"><span>${column.title}</span><div class="column-actions"><button data-action="edit-column" title="Kolonu Düzenle"><svg width="18" height="18" fill="currentColor"><use href="#icon-edit"></use></svg></button><button data-action="delete-column" class="delete-btn" title="Kolonu Sil"><svg width="18" height="18" fill="currentColor"><use href="#icon-trash"></use></svg></button></div></div><div class="task-list"></div>`;
  }

  // === DİYALOG YÖNETİMİ VE YARDIMCI FONKSİYONLAR ===
  function openDialog(dialogElement) {
    dialogElement.classList.remove("fade-out");
    dialogElement.classList.add("fade-in");
    dialogElement.showModal();
  }
  function closeDialog(dialogElement) {
    dialogElement.classList.remove("fade-in");
    dialogElement.classList.add("fade-out");
    // Fallback: force close after 300ms if animationend doesn't fire
    setTimeout(() => {
      if (dialogElement.open) {
        dialogElement.classList.remove("fade-out");
        dialogElement.close();
      }
    }, 300);
  }
  function openNoteDialog(noteId = null) {
    state.editingNoteId = noteId;
    const form = forms.note;
    const textarea = form.querySelector("#noteContent");
    const colorInput = form.querySelector("#noteColor");
    const folderSelect = form.querySelector("#noteFolder");
    const defaultColor = "#1a1a1a";
    folderSelect.innerHTML =
      `<option value="">Ana Dizin</option>` +
      state.folders
        .map((f) => `<option value="${f.id}">${f.name}</option>`)
        .join("");
    if (noteId) {
      const note = [...state.notes, ...state.archivedNotes].find(
        (n) => n.id === noteId
      );
      dialogs.note.querySelector("#dialogTitle").textContent = "Notu Düzenle";
      form.querySelector("#noteTitle").value = note.title;
      textarea.value = note.content;
      colorInput.value = note.color ?? "#1a1a1a";
      folderSelect.value = note.folderId ?? "";
    } else {
      dialogs.note.querySelector("#dialogTitle").textContent = "Yeni Not Ekle";
      form.reset();
      colorInput.value = defaultColor;
      folderSelect.value = "";
    }
    textarea.dispatchEvent(new Event("input"));
    openDialog(dialogs.note);
  }
  function openTaskDialog(taskId = null) {
    state.editingTaskId = taskId;
    const form = forms.task;
    const columnSelect = form.querySelector("#taskColumn");
    const subtaskListContainer = document.getElementById("subtaskList");
    const defaultColor = "#1a1a1a";
    if (state.kanban.columns.length === 0) {
      alert("Lütfen önce bir kolon ekleyin!");
      return;
    }
    columnSelect.innerHTML = state.kanban.columns
      .map((col) => `<option value="${col.id}">${col.title}</option>`)
      .join("");
    subtaskListContainer.innerHTML = "";
    const task = taskId
      ? [...state.kanban.tasks, ...state.kanban.archivedTasks].find(
          (t) => t.id === taskId
        )
      : null;
    if (task) {
      dialogs.task.querySelector("#taskDialogTitle").textContent =
        "Görevi Düzenle";
      form.querySelector("#taskTitle").value = task.title;
      form.querySelector("#taskContent").value = task.content;
      columnSelect.value = task.columnId;
      form.querySelector("#taskDate").value = task.date ?? "";
      form.querySelector("#taskTime").value = task.time ?? "";
      form.querySelector("#taskColor").value = task.color ?? defaultColor;
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask) => addSubtaskInput(subtask));
      }
    } else {
      dialogs.task.querySelector("#taskDialogTitle").textContent =
        "Yeni Görev Ekle";
      form.reset();
      form.querySelector("#taskColor").value = defaultColor;
    }
    form.querySelector("#taskContent").dispatchEvent(new Event("input"));
    openDialog(dialogs.task);
  }
  function addSubtaskInput(subtask = {}) {
    const subtaskListContainer = document.getElementById("subtaskList");
    const item = document.createElement("div");
    item.className = "subtask-item";
    const subtaskId = subtask.id || `sub_${Date.now()}_${Math.random()}`;
    item.innerHTML = `<input type="text" class="form-input" placeholder="Alt görev..." value="${
      subtask.text || ""
    }" data-id="${subtaskId}"><input type="checkbox" class="custom-checkbox" title="Tamamlandı olarak işaretle" ${
      subtask.completed ? "checked" : ""
    }> <button type="button" class="delete-subtask-btn" title="Alt görevi sil"><svg width="16" height="16"><use href="#icon-delete"></use></svg></button>`;
    item.querySelector(".delete-subtask-btn").addEventListener("click", () => {
      item.remove();
    });
    subtaskListContainer.appendChild(item);
  }
  function openColumnDialog(columnId = null) {
    state.editingColumnId = columnId;
    const dialogTitle = dialogs.column.querySelector("#columnDialogTitle");
    const columnInput = forms.column.querySelector("#columnTitle");
    if (columnId) {
      const column = state.kanban.columns.find((c) => c.id === columnId);
      dialogTitle.textContent = "Kolon Başlığını Düzenle";
      columnInput.value = column.title;
    } else {
      dialogTitle.textContent = "Yeni Kolon Ekle";
      forms.column.reset();
    }
    openDialog(dialogs.column);
  }
  function openViewDialog(type, id) {
    const isTask = type === "task";
    let item;
    if (isTask) {
      item = [...state.kanban.tasks, ...state.kanban.archivedTasks].find(
        (t) => t.id === id
      );
    } else {
      item = [...state.notes, ...state.archivedNotes].find((n) => n.id === id);
    }
    if (!item) return;
    const dialog = isTask ? dialogs.viewTask : dialogs.viewNote;
    if (isTask) dialog.dataset.currentTaskId = id;
    dialog.querySelector(
      isTask ? "#viewTaskTitle" : "#viewNoteTitle"
    ).textContent = item.title;
    dialog.querySelector(
      isTask ? "#viewTaskContent" : "#viewNoteContent"
    ).textContent = item.content;
    if (isTask) {
      const progressContainer = dialog.querySelector(
        "#viewTaskProgressContainer"
      );
      const subtasksList = dialog.querySelector("#viewTaskSubtasksList");
      progressContainer.innerHTML = "";
      subtasksList.innerHTML = "";
      subtasksList.style.display = "none";
      if (item.subtasks && item.subtasks.length > 0) {
        const totalCount = item.subtasks.length;
        const completedCount = item.subtasks.filter(
          (st) => st.completed
        ).length;
        const progressPercent =
          totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        progressContainer.innerHTML = `<span class="subtask-progress-label">${completedCount}/${totalCount} ALT GÖREV TAMAMLANDI</span><div class="subtask-progress-bar"><div class="subtask-progress-bar-inner" style="width: ${progressPercent}%;"></div></div>`;
        subtasksList.style.display = "flex";
        item.subtasks.forEach((subtask) => {
          const subtaskEl = document.createElement("div");
          subtaskEl.className = `view-subtask-item ${
            subtask.completed ? "completed" : ""
          }`;
          subtaskEl.dataset.action = "toggle-subtask";
          subtaskEl.dataset.subtaskId = subtask.id;

          subtaskEl.innerHTML = `
        <input type="checkbox" class="custom-checkbox" ${
          subtask.completed ? "checked" : ""
        }>
        <span>${subtask.text}</span>
    `;
          subtasksList.appendChild(subtaskEl);
        });
      }
      const reminderEl = dialog.querySelector("#viewTaskReminder");
      if (item.date) {
        const formattedDate = new Date(item.date).toLocaleDateString("tr-TR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const timeHtml = item.time
          ? `<span><svg width="16" height="16" fill="currentColor" style="vertical-align: -3px; margin-left: 12px; margin-right: 8px;"><use href="#icon-clock"></use></svg>${item.time}</span>`
          : "";
        reminderEl.innerHTML = `<span><svg width="16" height="16" fill="currentColor" style="vertical-align: -3px; margin-right: 8px;"><use href="#icon-calendar"></use></svg>${formattedDate}</span> ${timeHtml}`;
        reminderEl.style.display = "block";
      } else {
        reminderEl.style.display = "none";
      }
    }
    openDialog(dialog);
  }
  function openFolderDialog(folderId = null) {
    state.editingFolderId = folderId;
    const defaultColor = "#444444";
    const colorInput = forms.folder.querySelector("#folderColor");
    if (folderId) {
      const folder = state.folders.find((f) => f.id === folderId);
      dialogs.folder.querySelector("#folderDialogTitle").textContent =
        "Klasörü Düzenle";
      forms.folder.querySelector("#folderName").value = folder.name;
      colorInput.value = folder.color ?? "#444444";
    } else {
      dialogs.folder.querySelector("#folderDialogTitle").textContent =
        "Yeni Klasör Oluştur";
      forms.folder.reset();
      colorInput.value = defaultColor;
    }
    openDialog(dialogs.folder);
  }
  function openFolderViewDialog(folderId) {
    const folder = state.folders.find((f) => f.id === folderId);
    if (!folder) return;
    state.viewingFolderId = folderId;
    dialogs.folderView.querySelector("#folderViewTitle").textContent =
      folder.name;
    renderFolderContents(folderId);
    openDialog(dialogs.folderView);
  }
  function showConfirmDialog({
    message,
    confirmText = "Evet, Sil",
    confirmClass = "danger-btn",
  }) {
    return new Promise((resolve, reject) => {
      confirmDialogMessage.textContent = message;

      const confirmBtn = document.getElementById("confirmDialogConfirmBtn");
      confirmBtn.textContent = confirmText;

      // Önceki sınıfları temizle ve yenisini ekle
      confirmBtn.classList.remove("danger-btn", "save-btn");
      confirmBtn.classList.add(confirmClass);

      openDialog(dialogs.confirm);

      const onConfirm = () => {
        closeDialog(dialogs.confirm);
        resolve();
        cleanup();
      };
      const onCancel = () => {
        closeDialog(dialogs.confirm);
        reject();
        cleanup();
      };
      const cleanup = () => {
        confirmDialogConfirmBtn.removeEventListener("click", onConfirm);
        confirmDialogCancelBtn.removeEventListener("click", onCancel);
      };

      confirmDialogConfirmBtn.addEventListener("click", onConfirm);
      confirmDialogCancelBtn.addEventListener("click", onCancel);
    });
  }
  function autoResizeTextarea(textarea) {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    textarea.addEventListener("input", resize);
    resize();
  }
  function isColorLight(hexColor) {
    if (!hexColor || hexColor.length < 4) return !1;
    let hex = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const [r, g, b] = [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
    return (r * 299 + g * 587 + b * 114) / 1e3 > 149;
  }

  // === OLAY DİNLEYİCİLERİ VE AKSİYON YÖNETİMİ ===
  function setupEventListeners() {
    document.querySelectorAll(".form-textarea").forEach(autoResizeTextarea);
    document
      .getElementById("showNotesBtn")
      .addEventListener("click", () => switchView("notes"));
    document
      .getElementById("showTodosBtn")
      .addEventListener("click", () => switchView("kanban"));
    document
      .getElementById("showArchiveBtn")
      .addEventListener("click", () => switchView("archive"));
    addBtn.addEventListener("click", () =>
      state.currentView === "notes" ? openNoteDialog() : openTaskDialog()
    );
    addFolderBtn.addEventListener("click", () => openFolderDialog());
    addColumnBtn.addEventListener("click", () => openColumnDialog());
    document.getElementById("addSubtaskBtn").addEventListener("click", () => {
      addSubtaskInput();
    });

    document
      .getElementById("sidebarToggleBtn")
      .addEventListener("click", () => {
        appContainer.classList.toggle("sidebar-collapsed");
        localStorage.setItem(
          "sidebarCollapsed",
          appContainer.classList.contains("sidebar-collapsed")
        );
      });

    forms.task
      .querySelector("#clearDateTimeBtn")
      .addEventListener("click", () => {
        forms.task.querySelector("#taskDate").value = "";
        forms.task.querySelector("#taskTime").value = "";
      });

    document
      .getElementById("resetNoteColorBtn")
      .addEventListener(
        "click",
        () => (document.getElementById("noteColor").value = "#1a1a1a")
      );
    document
      .getElementById("resetTaskColorBtn")
      .addEventListener(
        "click",
        () => (document.getElementById("taskColor").value = "#1a1a1a")
      );
    document
      .getElementById("resetFolderColorBtn")
      .addEventListener(
        "click",
        () => (document.getElementById("folderColor").value = "#444444")
      );

    forms.note.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = forms.note.querySelector("#noteTitle").value.trim();
      const content = forms.note.querySelector("#noteContent").value.trim();
      let color = forms.note.querySelector("#noteColor").value;
      const folderId = forms.note.querySelector("#noteFolder").value || null;
      if (!title || !content) return;
      if (color === "#1a1a1a") color = null;
      if (state.editingNoteId) {
        const note = [...state.notes, ...state.archivedNotes].find(
          (n) => n.id === state.editingNoteId
        );
        if (note) Object.assign(note, { title, content, color, folderId });
      } else {
        state.notes.push({
          id: Date.now().toString(),
          title,
          content,
          color,
          folderId,
        });
      }
      saveData("notes");
      saveData("archivedNotes");
      render();
      if (state.viewingFolderId) renderFolderContents(state.viewingFolderId);
      closeDialog(dialogs.note);
    });
    forms.task.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = forms.task.querySelector("#taskTitle").value.trim();
      const content = forms.task.querySelector("#taskContent").value.trim();
      const columnId = forms.task.querySelector("#taskColumn").value;
      const subtasks = Array.from(
        document.querySelectorAll('.subtask-item input[type="text"]')
      )
        .map((input) => ({
          id: input.dataset.id || `sub_${Date.now()}_${Math.random()}`,
          text: input.value,
          completed: input.nextElementSibling.checked,
        }))
        .filter((subtask) => subtask.text.trim() !== "");
      let color = forms.task.querySelector("#taskColor").value;
      const date = forms.task.querySelector("#taskDate").value || null;
      const time = forms.task.querySelector("#taskTime").value || null;
      if (color === "#1a1a1a") color = null;
      if (!title || !content || !columnId) return;
      if (state.editingTaskId) {
        const task = [
          ...state.kanban.tasks,
          ...state.kanban.archivedTasks,
        ].find((t) => t.id === state.editingTaskId);
        if (task) {
          // Akıllı tamamlama mantığını burada kontrol et
          const allSubtasksCompleted =
            subtasks.length > 0 && subtasks.every((st) => st.completed);

          // Eğer ana görev zaten tamamlanmamışsa VE tüm alt görevler yeni tamamlandıysa...
          if (!task.completed && allSubtasksCompleted) {
            try {
              // Kullanıcıya sor
              await showConfirmDialog({
                message:
                  "Tüm alt görevler tamamlandı. Ana görevi de tamamlandı olarak işaretlemek ister misiniz?",
                confirmText: "Evet, İşaretle",
                confirmClass: "save-btn", // Mavi, onay butonu stili
              });
              // Kullanıcı "Evet" derse, ana görevi tamamlandı olarak işaretle
              task.completed = true;
            } catch (err) {
              // Kullanıcı "İptal" derse hiçbir şey yapma, devam et
            }
          }

          // Diğer tüm görev bilgilerini güncelle
          Object.assign(task, {
            title,
            content,
            columnId,
            date,
            time,
            color,
            subtasks,
          });
        }
      } else {
        // Bu yeni bir görev, normal şekilde ekle
        state.kanban.tasks.push({
          id: Date.now().toString(),
          columnId,
          title,
          content,
          color,
          date,
          time,
          completed: false,
          subtasks,
        });
      }
      saveData("kanban");
      render();
      closeDialog(dialogs.task);
    });
    forms.column.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = forms.column.querySelector("#columnTitle").value.trim();
      if (!title) return;
      if (state.editingColumnId) {
        const column = state.kanban.columns.find(
          (c) => c.id === state.editingColumnId
        );
        if (column) column.title = title;
      } else {
        state.kanban.columns.push({ id: Date.now().toString(), title: title });
      }
      saveData("kanban");
      render();
      closeDialog(dialogs.column);
    });
    forms.folder.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = forms.folder.querySelector("#folderName").value.trim();
      let color = forms.folder.querySelector("#folderColor").value;
      if (!name) return;
      if (color === "#444444") color = null;
      if (state.editingFolderId) {
        const folder = state.folders.find(
          (f) => f.id === state.editingFolderId
        );
        if (folder) Object.assign(folder, { name, color });
      } else {
        state.folders.push({ id: Date.now().toString(), name, color });
      }
      saveData("folders");
      render();
      closeDialog(dialogs.folder);
    });

    document
      .getElementById("clearArchiveBtn")
      .addEventListener("click", async () => {
        try {
          await showConfirmDialog({
            message:
              "Tüm arşivlenmiş notlar ve görevler kalıcı olarak silinecek. Emin misiniz?",
            confirmText: "Evet, Temizle",
            confirmClass: "danger-btn",
          });
          state.archivedNotes = [];
          state.kanban.archivedTasks = [];
          saveData("archivedNotes");
          saveData("kanban");
          render();
        } catch (err) {
          // Kullanıcı iptal etti
        }
      });

    const handleAction = async (e) => {
      const targetAction = e.target.closest("[data-action]");
      if (!targetAction) return;
      e.stopPropagation();
      const action = targetAction.dataset.action;
      const noteId = targetAction.closest(".note-card")?.dataset.noteId;
      const taskId = targetAction.closest(".task-card")?.dataset.taskId;
      const columnId = targetAction.closest(".kanban-column")?.dataset.columnId;
      const folderId = targetAction.closest(".folder-card")?.dataset.folderId;

      try {
        switch (action) {
          case "view-task":
            openViewDialog("task", taskId);
            break;
          case "view-note":
            openViewDialog("note", noteId);
            break;
          case "open-folder":
            openFolderViewDialog(folderId);
            break;
          case "edit-folder":
            openFolderDialog(folderId);
            break;
          case "edit-task":
            openTaskDialog(taskId);
            break;
          case "edit-note":
            openNoteDialog(noteId);
            break;
          case "edit-column":
            openColumnDialog(columnId);
            break;
          case "archive-note": {
            const noteIndex = state.notes.findIndex((n) => n.id === noteId);
            if (noteIndex > -1) {
              const [archivedNote] = state.notes.splice(noteIndex, 1);
              state.archivedNotes.unshift(archivedNote);
              saveData("notes");
              saveData("archivedNotes");
              render();
              if (state.viewingFolderId)
                renderFolderContents(state.viewingFolderId);
            }
            break;
          }
          case "restore-note": {
            const noteIndex = state.archivedNotes.findIndex(
              (n) => n.id === noteId
            );
            if (noteIndex > -1) {
              const [restoredNote] = state.archivedNotes.splice(noteIndex, 1);
              state.notes.unshift(restoredNote);
              saveData("notes");
              saveData("archivedNotes");
              render();
            }
            break;
          }
          case "delete-note-permanently": {
            await showConfirmDialog({
              message:
                "Bu not kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?",
            });
            state.archivedNotes = state.archivedNotes.filter(
              (n) => n.id !== noteId
            );
            saveData("archivedNotes");
            render();
            break;
          }
          case "archive-task": {
            const taskIndex = state.kanban.tasks.findIndex(
              (t) => t.id === taskId
            );
            if (taskIndex > -1) {
              const [archivedTask] = state.kanban.tasks.splice(taskIndex, 1);
              state.kanban.archivedTasks.unshift(archivedTask);
              saveData("kanban");
              render();
            }
            break;
          }
          case "restore-task": {
            const taskIndex = state.kanban.archivedTasks.findIndex(
              (t) => t.id === taskId
            );
            if (taskIndex > -1) {
              const [restoredTask] = state.kanban.archivedTasks.splice(
                taskIndex,
                1
              );
              state.kanban.tasks.unshift(restoredTask);
              saveData("kanban");
              render();
            }
            break;
          }
          case "delete-task-permanently": {
            await showConfirmDialog({
              message:
                "Bu görev kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?",
            });
            state.kanban.archivedTasks = state.kanban.archivedTasks.filter(
              (t) => t.id !== taskId
            );
            saveData("kanban");
            render();
            break;
          }
          case "move-note-to-root": {
            const note = state.notes.find((n) => n.id === noteId);
            if (note) {
              note.folderId = null;
              saveData("notes");
              render();
              if (state.viewingFolderId)
                renderFolderContents(state.viewingFolderId);
            }
            break;
          }
          case "delete-folder": {
            await showConfirmDialog({
              message:
                "Klasörü silmek istediğinize emin misiniz? İçindeki notlar ana dizine taşınacaktır.",
            });
            state.notes.forEach((note) => {
              if (note.folderId === folderId) note.folderId = null;
            });
            state.folders = state.folders.filter((f) => f.id !== folderId);
            saveData("folders");
            saveData("notes");
            render();
            break;
          }
          case "toggle-complete": {
            const task = state.kanban.tasks.find((t) => t.id === taskId);
            if (task) {
              task.completed = !task.completed;
              saveData("kanban");
              render();
            }
            break;
          }
          case "delete-column": {
            await showConfirmDialog({
              message:
                "Bu kolonu ve içindeki tüm görevleri silmek istediğinize emin misiniz? Bu işlem görevleri arşivlemez, kalıcı olarak siler.",
            });
            state.kanban.tasks = state.kanban.tasks.filter(
              (t) => t.columnId !== columnId
            );
            state.kanban.columns = state.kanban.columns.filter(
              (c) => c.id !== columnId
            );
            saveData("kanban");
            render();
            break;
          }
          case "move-task-up":
          case "move-task-down": {
            const taskElement = targetAction.closest(".task-card");
            if (!taskElement) break;
            const taskToMove = state.kanban.tasks.find((t) => t.id === taskId);
            if (!taskToMove) break;
            const tasksInSameColumn = state.kanban.tasks.filter(
              (t) => t.columnId === taskToMove.columnId
            );
            const currentIndex = tasksInSameColumn.findIndex(
              (t) => t.id === taskId
            );
            let swapTask = null;
            if (action === "move-task-up" && currentIndex > 0) {
              swapTask = tasksInSameColumn[currentIndex - 1];
            } else if (
              action === "move-task-down" &&
              currentIndex < tasksInSameColumn.length - 1
            ) {
              swapTask = tasksInSameColumn[currentIndex + 1];
            }
            if (!swapTask) break;
            const swapElement = document.querySelector(
              `.task-card[data-task-id="${swapTask.id}"]`
            );
            if (!swapElement) break;
            const taskRect = taskElement.getBoundingClientRect();
            const swapRect = swapElement.getBoundingClientRect();
            const distance = taskRect.top - swapRect.top;
            taskElement.classList.add("moving");
            swapElement.classList.add("moving");
            taskElement.style.transform = `translateY(${-distance}px)`;
            swapElement.style.transform = `translateY(${distance}px)`;
            await new Promise((resolve) => setTimeout(resolve, 250));
            taskElement.classList.remove("moving");
            swapElement.classList.remove("moving");
            taskElement.style.transform = "";
            swapElement.style.transform = "";
            const mainIndexA = state.kanban.tasks.findIndex(
              (t) => t.id === taskToMove.id
            );
            const mainIndexB = state.kanban.tasks.findIndex(
              (t) => t.id === swapTask.id
            );
            [state.kanban.tasks[mainIndexA], state.kanban.tasks[mainIndexB]] = [
              state.kanban.tasks[mainIndexB],
              state.kanban.tasks[mainIndexA],
            ];
            saveData("kanban");
            render();
            break;
          }
        }
      } catch (err) {}
    };
    contentContainer.addEventListener("click", handleAction);
    dialogs.folderView.addEventListener("click", handleAction);

    Object.values(dialogs).forEach((dialog) => {
      dialog.addEventListener("click", (e) => {
        if (e.target.matches("[data-close-dialog]") || e.target === dialog) {
          if (dialog.id === "confirmDialog") return;
          closeDialog(dialog);
        }
      });
      dialog.addEventListener("animationend", () => {
        if (dialog.classList.contains("fade-out")) {
          if (dialog.id === "folderViewDialog") state.viewingFolderId = null;
          dialog.classList.remove("fade-out");
          dialog.close();
        }
      });
    });

    const logo = document.getElementById("sidebarLogo");
    logo.addEventListener("mousemove", (e) => {
      const rect = logo.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const centerX = rect.width / 2,
        centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -20;
      const rotateY = ((x - centerX) / centerX) * 20;
      logo.style.transform = `perspective(1000px) scale(1.1) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    logo.addEventListener("mouseleave", () => {
      logo.style.transform =
        "perspective(1000px) scale(1) rotateX(0) rotateY(0)";
    });

    const handleViewDialogClick = async (e) => {
      const target = e.target.closest('[data-action="toggle-subtask"]');
      if (!target) return;

      const dialog = dialogs.viewTask;
      const currentTaskId = dialog.dataset.currentTaskId;
      const subtaskId = target.dataset.subtaskId;

      if (!currentTaskId || !subtaskId) return;

      const task = [...state.kanban.tasks, ...state.kanban.archivedTasks].find(
        (t) => t.id === currentTaskId
      );
      if (task && task.subtasks) {
        const subtask = task.subtasks.find((st) => st.id === subtaskId);
        if (subtask) {
          subtask.completed = !subtask.completed;

          const allSubtasksCompleted =
            task.subtasks.length > 0 &&
            task.subtasks.every((st) => st.completed);

          if (!task.completed && allSubtasksCompleted) {
            try {
              await showConfirmDialog({
                message:
                  "Tüm alt görevler tamamlandı. Ana görevi de tamamlandı olarak işaretlemek ister misiniz?",
                confirmText: "Evet, İşaretle",
                confirmClass: "save-btn",
              });
              task.completed = true;
            } catch (err) {}
          }

          saveData("kanban"); // Değişikliği kaydet

          openViewDialog("task", currentTaskId);
          render();
        }
      }
    };

    const themeToggleBtn = document.getElementById("themeToggleBtn");
    themeToggleBtn.addEventListener("click", () => {
      const isLightTheme = document.body.classList.toggle("light-theme");
      localStorage.setItem("MyMemos_theme", isLightTheme ? "light" : "dark");
    });

    dialogs.viewTask.addEventListener("click", handleViewDialogClick);
    setupGlobalSearch();

    // === İÇE / DIŞA AKTARMA MANTIĞI ===
    const exportDataBtn = document.getElementById("exportDataBtn");
    const importDataBtn = document.getElementById("importDataBtn");
    const importFileInput = document.getElementById("importFileInput");

    // Dışa Aktarma Butonu
    exportDataBtn.addEventListener("click", () => {
      // Kaydedilecek tüm veriyi tek bir objede topla
      const dataToExport = {
        notes: state.notes,
        archivedNotes: state.archivedNotes,
        folders: state.folders,
        kanban: state.kanban,
        theme: localStorage.getItem("MyMemos_theme") || "dark",
      };

      const dataStr = JSON.stringify(dataToExport, null, 2); // Okunabilir formatta JSON
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      const date = new Date();
      const formattedDate = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      a.href = url;
      a.download = `MyMemos_Yedek_${formattedDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // İçe Aktarma Butonu (Gizli input'u tetikler)
    importDataBtn.addEventListener("click", () => {
      importFileInput.click();
    });

    // Dosya seçildiğinde çalışacak olan olay
    importFileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target.result);

          // Verinin geçerli olup olmadığını kontrol et
          if (!importedData.notes || !importedData.kanban) {
            throw new Error("Geçersiz yedek dosyası.");
          }

          // Kullanıcıyı uyar ve onayı al
          await showConfirmDialog({
            message:
              "İçe aktarma işlemi mevcut tüm verilerinizi silecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?",
            confirmText: "Evet, İçe Aktar",
            confirmClass: "danger-btn",
          });

          // Veriyi state'e yükle (eski versiyonlarla uyumluluk için kontroller ekle)
          state.notes = importedData.notes || [];
          state.archivedNotes = importedData.archivedNotes || [];
          state.folders = importedData.folders || [];
          state.kanban = {
            columns: importedData.kanban.columns || [],
            tasks: (importedData.kanban.tasks || []).map((t) => ({
              ...t,
              subtasks: t.subtasks || [],
            })),
            archivedTasks: (importedData.kanban.archivedTasks || []).map(
              (t) => ({ ...t, subtasks: t.subtasks || [] })
            ),
          };

          // Temayı uygula
          const theme = importedData.theme || "dark";
          document.body.className = theme === "light" ? "light-theme" : "";
          localStorage.setItem("MyMemos_theme", theme);

          // Tüm veriyi localStorage'a kaydet
          saveData("notes");
          saveData("archivedNotes");
          saveData("folders");
          saveData("kanban");

          // Arayüzü yenile
          render();
          alert("Veriler başarıyla içe aktarıldı!");
        } catch (error) {
          alert(`Hata: ${error.message}`);
        } finally {
          // Input'u sıfırla ki aynı dosyayı tekrar seçebilsin
          importFileInput.value = "";
        }
      };
      reader.readAsText(file);
    });

    const mainContent = document.querySelector(".main-content");

    mainContent.addEventListener("click", () => {
      // Eğer kenar çubuğu açıksa (yani collapsed class'ı YOKSA)
      if (!appContainer.classList.contains("sidebar-collapsed")) {
        // Kapatmak için collapsed class'ını ekle
        appContainer.classList.add("sidebar-collapsed");
        localStorage.setItem("sidebarCollapsed", "true");
      }
    });
  }

  // === GLOBAL ARAMA MODU FONKSİYONLARI ===
  function setupGlobalSearch() {
    const searchBtn = document.getElementById("searchBtn");
    const searchOverlay = document.getElementById("globalSearchOverlay");
    const searchInput = document.getElementById("globalSearchInput");
    const searchResultsContainer = document.getElementById(
      "searchResultsContainer"
    );

    let startRect;

    const openSearch = () => {
      startRect = searchBtn.getBoundingClientRect();
      const endRect = searchInput.getBoundingClientRect();

      const deltaX = startRect.left - endRect.left;
      const deltaY = startRect.top - endRect.top;
      const deltaW = startRect.width / endRect.width;
      const deltaH = startRect.height / endRect.height;

      searchInput.style.transition = "none";
      searchInput.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;

      searchOverlay.classList.add("visible");

      requestAnimationFrame(() => {
        searchInput.style.transition = "";
        searchInput.style.transform = "none";
        searchInput.focus();
      });

      document.addEventListener("keydown", handleEscKey);
    };

    const closeSearch = () => {
      startRect = searchBtn.getBoundingClientRect();
      const endRect = searchInput.getBoundingClientRect();
      const deltaX = startRect.left - endRect.left;
      const deltaY = startRect.top - endRect.top;
      const deltaW = startRect.width / endRect.width;
      const deltaH = startRect.height / endRect.height;

      searchInput.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
      searchOverlay.classList.remove("visible");

      searchInput.addEventListener(
        "transitionend",
        () => {
          searchInput.style.transition = "none";
          searchInput.value = "";
          searchResultsContainer.innerHTML = "";
        },
        { once: true }
      );

      document.removeEventListener("keydown", handleEscKey);
    };

    const renderSearchResults = () => {
      const term = searchInput.value.toLowerCase().trim();
      if (!term) {
        searchResultsContainer.innerHTML = "";
        return;
      }

      const results = {
        notes: state.notes.filter(
          (n) =>
            n.title.toLowerCase().includes(term) ||
            n.content.toLowerCase().includes(term)
        ),
        tasks: state.kanban.tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(term) ||
            t.content.toLowerCase().includes(term)
        ),
        archive: [...state.archivedNotes, ...state.kanban.archivedTasks].filter(
          (item) =>
            item.title.toLowerCase().includes(term) ||
            item.content.toLowerCase().includes(term)
        ),
      };

      let html = "";

      if (results.notes.length > 0) {
        html += `<div class="search-result-group"><div class="search-result-header"><svg width="18" height="18"><use href="#icon-notes-view"></use></svg><span>NOTLAR</span></div>`;
        results.notes.forEach((note) => {
          html += getSearchResultItemHtml(note, "note");
        });
        html += `</div>`;
      }
      if (results.tasks.length > 0) {
        html += `<div class="search-result-group"><div class="search-result-header"><svg width="18" height="18"><use href="#icon-kanban-view"></use></svg><span>YAPILACAKLAR PANOSU</span></div>`;
        results.tasks.forEach((task) => {
          html += getSearchResultItemHtml(task, "task");
        });
        html += `</div>`;
      }
      if (results.archive.length > 0) {
        html += `<div class="search-result-group"><div class="search-result-header"><svg width="18" height="18"><use href="#icon-archive"></use></svg><span>ARŞİV</span></div>`;
        results.archive.forEach((item) => {
          html += getSearchResultItemHtml(
            item,
            item.hasOwnProperty("columnId") ? "task" : "note"
          );
        });
        html += `</div>`;
      }

      searchResultsContainer.innerHTML =
        html ||
        `<div class="empty-state" style="border:none; padding: 2rem;">Sonuç bulunamadı.</div>`;
    };

    const getSearchResultItemHtml = (item, type) => {
      const isTask = type === "task";
      const icon = isTask ? "#icon-check" : "#icon-notes-view";
      return `
        <div class="search-result-item" data-action="${
          isTask ? "view-task" : "view-note"
        }" data-${isTask ? "task" : "note"}-id="${item.id}">
            <div class="icon"><svg width="24" height="24"><use href="${icon}"></use></svg></div>
            <div class="text">
                <div class="title">${item.title}</div>
                <div class="content">${item.content}</div>
            </div>
        </div>`;
    };

    const handleEscKey = (e) => {
      if (e.key === "Escape") {
        closeSearch();
      }
    };

    searchBtn.addEventListener("click", openSearch);
    searchInput.addEventListener("input", renderSearchResults);
    searchOverlay.addEventListener("click", (e) => {
      if (e.target === searchOverlay) {
        closeSearch();
      }
    });
    searchResultsContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".search-result-item");
      if (item) {
        closeSearch();
      }
    });
  }

  // === BAŞLANGIÇ ===
  loadData();
  setupEventListeners();
  render();
});
