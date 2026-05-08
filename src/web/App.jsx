import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { taskModel, taskStorage } from './storage'

const TAB_KEYS = {
  notDone: 'not-done',
  done: 'done',
  planned: 'planned',
}

const LANGUAGE_OPTIONS = [
  { code: 'en-US', locale: 'en-US', flag: '🇺🇸' },
  { code: 'en-GB', locale: 'en-GB', flag: '🇬🇧' },
  { code: 'zh-CN', locale: 'zh-CN', flag: '🇨🇳' },
  { code: 'ja-JP', locale: 'ja-JP', flag: '🇯🇵' },
  { code: 'ko-KR', locale: 'ko-KR', flag: '🇰🇷' },
  { code: 'fr-FR', locale: 'fr-FR', flag: '🇫🇷' },
  { code: 'es-ES', locale: 'es-ES', flag: '🇪🇸' },
  { code: 'it-IT', locale: 'it-IT', flag: '🇮🇹' },
]

const DEFAULT_LANGUAGE_CODE = LANGUAGE_OPTIONS[0].code

const TRANSLATIONS = {
  'en-US': {
    languageName: 'American English',
    openMenu: 'Open menu',
    openLanguageMenu: 'Open language menu',
    chooseLanguage: 'Choose language',
    setTimeZone: 'Set Time Zone',
    login: 'Login',
    loginMvpAlert: 'Login is not part of this MVP yet.',
    taskListTabs: 'Task list tabs',
    notDoneTab: 'Not Done',
    doneTab: 'Done',
    plannedTab: 'Planned',
    addTaskTitle: 'Add Task',
    startSpeechToText: 'Start speech to text',
    stopSpeechToText: 'Stop speech to text',
    speakTaskDescription: 'Speak task description',
    speechNotSupportedTitle: 'Speech-to-text not supported',
    taskDescription: 'Task description',
    dueDate: 'Due date',
    setTime: 'Set time (optional)',
    clearTime: 'Clear time',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    setRecurringRule: 'Set recurring rule',
    doesNotRepeat: 'Does not repeat',
    repeatDaily: 'Repeat daily',
    repeatWeekly: 'Repeat weekly',
    repeatWeekdaysShort: 'M-F',
    repeatWeekdays: 'Repeat M-F',
    addTask: 'Add Task',
    today: 'Today',
    loading: 'Loading Duebly...',
    emptyDone: 'No completed tasks yet.',
    emptyPlanned: 'Nothing planned for the future.',
    emptyNotDone: "You're all caught up!",
    movedToTomorrow: 'Moved to tomorrow',
    movedToDate: 'Moved to {date}',
    movedToNextOccurrence: 'Moved to next occurrence',
    taskDeleted: 'Task Deleted',
    taskMarkedDone: 'Task marked as done',
    movedToDone: 'Moved to Done',
    savedForTomorrow: 'Saved for tomorrow',
    saveForLater: 'Save for Later',
    undo: 'Undo',
    delete: 'Delete',
    markAsDone: 'Mark as Done',
    recurringTask: 'Recurring task',
    recurringBadge: '(recurring)',
    editTask: 'Edit task',
    changeFrequency: 'Change frequency',
    changeLabel: 'Change label',
    deleteTask: 'Delete task',
    editTaskDescription: 'Edit task description',
    cancel: 'Cancel',
    save: 'Save',
    speechUnsupportedToast: 'Speech-to-text is not supported in this browser',
    micDeniedToast: 'Microphone permission was denied',
    speechFailedToast: 'Speech-to-text failed, please try again',
    unableStartSpeechToast: 'Unable to start speech-to-text',
    mobileMicKeyboardBetterToast: 'Use keyboard microphone',
    progressAria: 'Not Done progress {completed} out of {total}',
    markTaskDoneAria: 'Mark {task} as done',
    changeDateAria: 'Change date for {task}',
    labelAria: 'Label {label}',
    openTaskMenuAria: 'Open menu for {task}',
    labelGeneral: 'General',
    labelPriority: 'Priority',
    labelWork: 'Work',
    labelLife: 'Life',
    labelHealth: 'Health',
    labelFinance: 'Finance',
    labelFamily: 'Family',
    labelHome: 'Home',
    labelErrands: 'Errands',
    labelSchool: 'School',
    labelEvent: 'Event',
    labelTravel: 'Travel',
  },
  'en-GB': {
    languageName: 'British English',
    setTime: 'Set time (optional)',
    clearTime: 'Clear time',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    changeLabel: 'Change label',
  },
  'zh-CN': {
    languageName: '简体中文',
    openMenu: '打开菜单',
    openLanguageMenu: '打开语言菜单',
    chooseLanguage: '选择语言',
    setTimeZone: '设置时区',
    login: '登录',
    loginMvpAlert: '登录暂未包含在此 MVP 中。',
    taskListTabs: '任务列表标签',
    notDoneTab: '待办',
    doneTab: '已完成',
    plannedTab: '计划',
    addTaskTitle: '添加任务',
    startSpeechToText: '开始语音转文字',
    stopSpeechToText: '停止语音转文字',
    speakTaskDescription: '说出任务描述',
    speechNotSupportedTitle: '浏览器不支持语音转文字',
    taskDescription: '任务描述',
    dueDate: '截止日期',
    setTime: '设置时间（可选）',
    clearTime: '清除时间',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    setRecurringRule: '设置重复规则',
    doesNotRepeat: '不重复',
    repeatDaily: '每天重复',
    repeatWeekly: '每周重复',
    repeatWeekdaysShort: '周一至周五',
    repeatWeekdays: '每周一至周五重复',
    addTask: '添加任务',
    today: '今天',
    loading: 'Duebly 加载中...',
    emptyDone: '还没有已完成任务。',
    emptyPlanned: '未来暂无计划任务。',
    emptyNotDone: '你已全部完成！',
    movedToTomorrow: '已移动到明天',
    movedToDate: '已移动到 {date}',
    movedToNextOccurrence: '已移动到下一次',
    taskDeleted: '任务已删除',
    taskMarkedDone: '任务已标记为完成',
    movedToDone: '已移至已完成',
    savedForTomorrow: '已保存到明天',
    saveForLater: '稍后处理',
    undo: '撤销',
    delete: '删除',
    markAsDone: '标记为已完成',
    recurringTask: '重复任务',
    recurringBadge: '(重复)',
    editTask: '编辑任务',
    changeFrequency: '修改频率',
    changeLabel: '修改标签',
    deleteTask: '删除任务',
    editTaskDescription: '编辑任务描述',
    cancel: '取消',
    save: '保存',
    speechUnsupportedToast: '此浏览器不支持语音转文字',
    micDeniedToast: '麦克风权限被拒绝',
    speechFailedToast: '语音转文字失败，请重试',
    unableStartSpeechToast: '无法启动语音转文字',
    mobileMicKeyboardBetterToast: '使用键盘麦克风',
    progressAria: '待办进度 {completed}/{total}',
    markTaskDoneAria: '将 {task} 标记为已完成',
    changeDateAria: '修改 {task} 的日期',
    labelAria: '标签 {label}',
    openTaskMenuAria: '打开 {task} 的菜单',
    labelGeneral: '通用',
    labelPriority: '优先',
    labelWork: '工作',
    labelLife: '生活',
    labelHealth: '健康',
    labelFinance: '财务',
    labelFamily: '家庭',
    labelHome: '居家',
    labelErrands: '跑腿',
    labelSchool: '学校',
    labelEvent: '活动',
    labelTravel: '旅行',
  },
  'ja-JP': {
    languageName: '日本語',
    openMenu: 'メニューを開く',
    openLanguageMenu: '言語メニューを開く',
    chooseLanguage: '言語を選択',
    setTimeZone: 'タイムゾーンを設定',
    login: 'ログイン',
    loginMvpAlert: 'ログインはこの MVP では未対応です。',
    taskListTabs: 'タスク一覧タブ',
    notDoneTab: '未完了',
    doneTab: '完了',
    plannedTab: '予定',
    addTaskTitle: 'タスクを追加',
    startSpeechToText: '音声入力を開始',
    stopSpeechToText: '音声入力を停止',
    speakTaskDescription: 'タスク内容を話す',
    speechNotSupportedTitle: 'このブラウザは音声入力に対応していません',
    taskDescription: 'タスク内容',
    dueDate: '期限日',
    setTime: '時刻を設定（任意）',
    clearTime: '時刻をクリア',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    setRecurringRule: '繰り返し設定',
    doesNotRepeat: '繰り返さない',
    repeatDaily: '毎日繰り返す',
    repeatWeekly: '毎週繰り返す',
    repeatWeekdaysShort: '月-金',
    repeatWeekdays: '平日に繰り返す',
    addTask: 'タスクを追加',
    today: '今日',
    loading: 'Duebly を読み込み中...',
    emptyDone: '完了したタスクはまだありません。',
    emptyPlanned: '今後の予定タスクはありません。',
    emptyNotDone: 'すべて完了しています！',
    movedToTomorrow: '明日に移動しました',
    movedToDate: '{date} に移動しました',
    movedToNextOccurrence: '次の予定に移動しました',
    taskDeleted: 'タスクを削除しました',
    taskMarkedDone: 'タスクを完了にしました',
    movedToDone: '完了に移動しました',
    savedForTomorrow: '明日用に保存しました',
    saveForLater: 'あとで対応',
    undo: '元に戻す',
    delete: '削除',
    markAsDone: '完了にする',
    recurringTask: '繰り返しタスク',
    recurringBadge: '(繰り返し)',
    editTask: 'タスクを編集',
    changeFrequency: '頻度を変更',
    changeLabel: 'ラベルを変更',
    deleteTask: 'タスクを削除',
    editTaskDescription: 'タスク内容を編集',
    cancel: 'キャンセル',
    save: '保存',
    speechUnsupportedToast: 'このブラウザは音声入力に対応していません',
    micDeniedToast: 'マイクの権限が拒否されました',
    speechFailedToast: '音声入力に失敗しました。もう一度お試しください',
    unableStartSpeechToast: '音声入力を開始できませんでした',
    mobileMicKeyboardBetterToast: 'キーボードのマイクを使ってください',
    progressAria: '未完了の進捗 {completed}/{total}',
    markTaskDoneAria: '{task} を完了にする',
    changeDateAria: '{task} の日付を変更',
    labelAria: 'ラベル {label}',
    openTaskMenuAria: '{task} のメニューを開く',
    labelGeneral: '一般',
    labelPriority: '優先',
    labelWork: '仕事',
    labelLife: '生活',
    labelHealth: '健康',
    labelFinance: '財務',
    labelFamily: '家族',
    labelHome: '家',
    labelErrands: '用事',
    labelSchool: '学校',
    labelEvent: 'イベント',
    labelTravel: '旅行',
  },
  'ko-KR': {
    languageName: '한국어',
    openMenu: '메뉴 열기',
    openLanguageMenu: '언어 메뉴 열기',
    chooseLanguage: '언어 선택',
    setTimeZone: '시간대 설정',
    login: '로그인',
    loginMvpAlert: '로그인은 현재 MVP에 포함되어 있지 않습니다.',
    taskListTabs: '작업 목록 탭',
    notDoneTab: '미완료',
    doneTab: '완료됨',
    plannedTab: '예정',
    addTaskTitle: '작업 추가',
    startSpeechToText: '음성 입력 시작',
    stopSpeechToText: '음성 입력 중지',
    speakTaskDescription: '작업 설명 말하기',
    speechNotSupportedTitle: '이 브라우저는 음성 입력을 지원하지 않습니다',
    taskDescription: '작업 설명',
    dueDate: '마감일',
    setTime: '시간 설정(선택 사항)',
    clearTime: '시간 지우기',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    setRecurringRule: '반복 규칙 설정',
    doesNotRepeat: '반복 안 함',
    repeatDaily: '매일 반복',
    repeatWeekly: '매주 반복',
    repeatWeekdaysShort: '월-금',
    repeatWeekdays: '평일 반복',
    addTask: '작업 추가',
    today: '오늘',
    loading: 'Duebly 로딩 중...',
    emptyDone: '완료된 작업이 아직 없습니다.',
    emptyPlanned: '예정된 작업이 없습니다.',
    emptyNotDone: '모두 완료했습니다!',
    movedToTomorrow: '내일로 이동됨',
    movedToDate: '{date}(으)로 이동됨',
    movedToNextOccurrence: '다음 일정으로 이동됨',
    taskDeleted: '작업이 삭제됨',
    taskMarkedDone: '작업을 완료로 표시했습니다',
    movedToDone: '완료됨으로 이동됨',
    savedForTomorrow: '내일로 저장됨',
    saveForLater: '나중에 처리',
    undo: '실행 취소',
    delete: '삭제',
    markAsDone: '완료로 표시',
    recurringTask: '반복 작업',
    recurringBadge: '(반복)',
    editTask: '작업 편집',
    changeFrequency: '빈도 변경',
    changeLabel: '라벨 변경',
    deleteTask: '작업 삭제',
    editTaskDescription: '작업 설명 편집',
    cancel: '취소',
    save: '저장',
    speechUnsupportedToast: '이 브라우저는 음성 입력을 지원하지 않습니다',
    micDeniedToast: '마이크 권한이 거부되었습니다',
    speechFailedToast: '음성 입력에 실패했습니다. 다시 시도해 주세요',
    unableStartSpeechToast: '음성 입력을 시작할 수 없습니다',
    mobileMicKeyboardBetterToast: '키보드 마이크를 사용하세요',
    progressAria: '미완료 진행률 {completed}/{total}',
    markTaskDoneAria: '{task} 완료로 표시',
    changeDateAria: '{task} 날짜 변경',
    labelAria: '라벨 {label}',
    openTaskMenuAria: '{task} 메뉴 열기',
    labelGeneral: '일반',
    labelPriority: '우선',
    labelWork: '업무',
    labelLife: '생활',
    labelHealth: '건강',
    labelFinance: '재정',
    labelFamily: '가족',
    labelHome: '집',
    labelErrands: '볼일',
    labelSchool: '학교',
    labelEvent: '이벤트',
    labelTravel: '여행',
  },
  'fr-FR': {
    languageName: 'Français',
    openMenu: 'Ouvrir le menu',
    openLanguageMenu: 'Ouvrir le menu des langues',
    chooseLanguage: 'Choisir la langue',
    setTimeZone: 'Définir le fuseau horaire',
    login: 'Connexion',
    loginMvpAlert: 'La connexion ne fait pas encore partie de ce MVP.',
    taskListTabs: 'Onglets de tâches',
    notDoneTab: 'À faire',
    doneTab: 'Terminées',
    plannedTab: 'Planifiées',
    addTaskTitle: 'Ajouter une tâche',
    startSpeechToText: 'Démarrer la dictée',
    stopSpeechToText: 'Arrêter la dictée',
    speakTaskDescription: 'Dicter la description de la tâche',
    speechNotSupportedTitle: 'La dictée vocale n’est pas prise en charge',
    taskDescription: 'Description de la tâche',
    dueDate: 'Date d’échéance',
    setTime: 'Définir l’heure (facultatif)',
    clearTime: 'Effacer l’heure',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    setRecurringRule: 'Définir la récurrence',
    doesNotRepeat: 'Ne se répète pas',
    repeatDaily: 'Répéter chaque jour',
    repeatWeekly: 'Répéter chaque semaine',
    repeatWeekdaysShort: 'lun-ven',
    repeatWeekdays: 'Répéter lun-ven',
    addTask: 'Ajouter la tâche',
    today: 'Aujourd’hui',
    loading: 'Chargement de Duebly...',
    emptyDone: 'Aucune tâche terminée pour le moment.',
    emptyPlanned: 'Aucune tâche planifiée pour l’avenir.',
    emptyNotDone: 'Tout est à jour !',
    movedToTomorrow: 'Déplacée à demain',
    movedToDate: 'Déplacée au {date}',
    movedToNextOccurrence: 'Déplacée à la prochaine occurrence',
    taskDeleted: 'Tâche supprimée',
    taskMarkedDone: 'Tâche marquée comme terminée',
    movedToDone: 'Déplacée vers Terminées',
    savedForTomorrow: 'Enregistrée pour demain',
    saveForLater: 'Garder pour plus tard',
    undo: 'Annuler',
    delete: 'Supprimer',
    markAsDone: 'Marquer comme terminée',
    recurringTask: 'Tâche récurrente',
    recurringBadge: '(récurrente)',
    editTask: 'Modifier la tâche',
    changeFrequency: 'Changer la fréquence',
    changeLabel: 'Changer l’étiquette',
    deleteTask: 'Supprimer la tâche',
    editTaskDescription: 'Modifier la description de la tâche',
    cancel: 'Annuler',
    save: 'Enregistrer',
    speechUnsupportedToast: 'La dictée vocale n’est pas prise en charge sur ce navigateur',
    micDeniedToast: 'L’autorisation du microphone a été refusée',
    speechFailedToast: 'La dictée vocale a échoué, veuillez réessayer',
    unableStartSpeechToast: 'Impossible de démarrer la dictée vocale',
    mobileMicKeyboardBetterToast: 'Utilisez le micro du clavier',
    progressAria: 'Progression À faire {completed} sur {total}',
    markTaskDoneAria: 'Marquer {task} comme terminée',
    changeDateAria: 'Changer la date de {task}',
    labelAria: 'Étiquette {label}',
    openTaskMenuAria: 'Ouvrir le menu pour {task}',
    labelGeneral: 'Général',
    labelPriority: 'Priorité',
    labelWork: 'Travail',
    labelLife: 'Vie',
    labelHealth: 'Santé',
    labelFinance: 'Finance',
    labelFamily: 'Famille',
    labelHome: 'Maison',
    labelErrands: 'Courses',
    labelSchool: 'École',
    labelEvent: 'Événement',
    labelTravel: 'Voyage',
  },
  'es-ES': {
    languageName: 'Español',
    openMenu: 'Abrir menú',
    openLanguageMenu: 'Abrir menú de idioma',
    chooseLanguage: 'Elegir idioma',
    setTimeZone: 'Configurar zona horaria',
    login: 'Iniciar sesión',
    loginMvpAlert: 'El inicio de sesión aún no forma parte de este MVP.',
    taskListTabs: 'Pestañas de tareas',
    notDoneTab: 'Pendientes',
    doneTab: 'Hechas',
    plannedTab: 'Planificadas',
    addTaskTitle: 'Añadir tarea',
    startSpeechToText: 'Iniciar voz a texto',
    stopSpeechToText: 'Detener voz a texto',
    speakTaskDescription: 'Decir descripción de la tarea',
    speechNotSupportedTitle: 'Voz a texto no compatible',
    taskDescription: 'Descripción de la tarea',
    dueDate: 'Fecha límite',
    setTime: 'Configurar hora (opcional)',
    clearTime: 'Borrar hora',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    setRecurringRule: 'Configurar repetición',
    doesNotRepeat: 'No se repite',
    repeatDaily: 'Repetir a diario',
    repeatWeekly: 'Repetir semanalmente',
    repeatWeekdaysShort: 'lun-vie',
    repeatWeekdays: 'Repetir lun-vie',
    addTask: 'Añadir tarea',
    today: 'Hoy',
    loading: 'Cargando Duebly...',
    emptyDone: 'Todavía no hay tareas completadas.',
    emptyPlanned: 'No hay nada planificado para el futuro.',
    emptyNotDone: '¡Todo al día!',
    movedToTomorrow: 'Movido a mañana',
    movedToDate: 'Movido a {date}',
    movedToNextOccurrence: 'Movido a la próxima ocurrencia',
    taskDeleted: 'Tarea eliminada',
    taskMarkedDone: 'Tarea marcada como hecha',
    movedToDone: 'Movido a Hechas',
    savedForTomorrow: 'Guardado para mañana',
    saveForLater: 'Guardar para después',
    undo: 'Deshacer',
    delete: 'Eliminar',
    markAsDone: 'Marcar como hecha',
    recurringTask: 'Tarea recurrente',
    recurringBadge: '(recurrente)',
    editTask: 'Editar tarea',
    changeFrequency: 'Cambiar frecuencia',
    changeLabel: 'Cambiar etiqueta',
    deleteTask: 'Eliminar tarea',
    editTaskDescription: 'Editar descripción de la tarea',
    cancel: 'Cancelar',
    save: 'Guardar',
    speechUnsupportedToast: 'Voz a texto no es compatible con este navegador',
    micDeniedToast: 'Se denegó el permiso del micrófono',
    speechFailedToast: 'Falló voz a texto, inténtalo de nuevo',
    unableStartSpeechToast: 'No se pudo iniciar voz a texto',
    mobileMicKeyboardBetterToast: 'Usa el micrófono del teclado',
    progressAria: 'Progreso de Pendientes {completed} de {total}',
    markTaskDoneAria: 'Marcar {task} como hecha',
    changeDateAria: 'Cambiar fecha de {task}',
    labelAria: 'Etiqueta {label}',
    openTaskMenuAria: 'Abrir menú para {task}',
    labelGeneral: 'General',
    labelPriority: 'Prioridad',
    labelWork: 'Trabajo',
    labelLife: 'Vida',
    labelHealth: 'Salud',
    labelFinance: 'Finanzas',
    labelFamily: 'Familia',
    labelHome: 'Hogar',
    labelErrands: 'Recados',
    labelSchool: 'Escuela',
    labelEvent: 'Evento',
    labelTravel: 'Viaje',
  },
  'it-IT': {
    languageName: 'Italiano',
    openMenu: 'Apri menu',
    openLanguageMenu: 'Apri menu lingua',
    chooseLanguage: 'Scegli lingua',
    setTimeZone: 'Imposta fuso orario',
    login: 'Accedi',
    loginMvpAlert: 'Il login non fa ancora parte di questo MVP.',
    taskListTabs: 'Schede elenco attività',
    notDoneTab: 'Da fare',
    doneTab: 'Fatte',
    plannedTab: 'Pianificate',
    addTaskTitle: 'Aggiungi attività',
    startSpeechToText: 'Avvia voce a testo',
    stopSpeechToText: 'Interrompi voce a testo',
    speakTaskDescription: 'Pronuncia la descrizione attività',
    speechNotSupportedTitle: 'Voce a testo non supportata',
    taskDescription: 'Descrizione attività',
    dueDate: 'Data di scadenza',
    setTime: 'Imposta ora (facoltativo)',
    clearTime: 'Cancella ora',
    timeAmAbbrev: 'a',
    timePmAbbrev: 'p',
    setRecurringRule: 'Imposta ricorrenza',
    doesNotRepeat: 'Non si ripete',
    repeatDaily: 'Ripeti ogni giorno',
    repeatWeekly: 'Ripeti ogni settimana',
    repeatWeekdaysShort: 'lun-ven',
    repeatWeekdays: 'Ripeti lun-ven',
    addTask: 'Aggiungi attività',
    today: 'Oggi',
    loading: 'Caricamento di Duebly...',
    emptyDone: 'Nessuna attività completata al momento.',
    emptyPlanned: 'Niente pianificato per il futuro.',
    emptyNotDone: 'Tutto aggiornato!',
    movedToTomorrow: 'Spostata a domani',
    movedToDate: 'Spostata al {date}',
    movedToNextOccurrence: 'Spostata alla prossima occorrenza',
    taskDeleted: 'Attività eliminata',
    taskMarkedDone: 'Attività segnata come fatta',
    movedToDone: 'Spostata in Fatte',
    savedForTomorrow: 'Salvata per domani',
    saveForLater: 'Salva per dopo',
    undo: 'Annulla',
    delete: 'Elimina',
    markAsDone: 'Segna come fatta',
    recurringTask: 'Attività ricorrente',
    recurringBadge: '(ricorrente)',
    editTask: 'Modifica attività',
    changeFrequency: 'Cambia frequenza',
    changeLabel: 'Cambia etichetta',
    deleteTask: 'Elimina attività',
    editTaskDescription: 'Modifica descrizione attività',
    cancel: 'Annulla',
    save: 'Salva',
    speechUnsupportedToast: 'Voce a testo non supportata in questo browser',
    micDeniedToast: 'Permesso microfono negato',
    speechFailedToast: 'Voce a testo non riuscita, riprova',
    unableStartSpeechToast: 'Impossibile avviare voce a testo',
    mobileMicKeyboardBetterToast: 'Usa il microfono della tastiera',
    progressAria: 'Progresso Da fare {completed} su {total}',
    markTaskDoneAria: 'Segna {task} come fatta',
    changeDateAria: 'Cambia data per {task}',
    labelAria: 'Etichetta {label}',
    openTaskMenuAria: 'Apri menu per {task}',
    labelGeneral: 'Generale',
    labelPriority: 'Priorità',
    labelWork: 'Lavoro',
    labelLife: 'Vita',
    labelHealth: 'Salute',
    labelFinance: 'Finanza',
    labelFamily: 'Famiglia',
    labelHome: 'Casa',
    labelErrands: 'Commissioni',
    labelSchool: 'Scuola',
    labelEvent: 'Evento',
    labelTravel: 'Viaggio',
  },
}

const interpolateText = (value, replacements = {}) => {
  if (typeof value !== 'string') {
    return ''
  }

  return Object.entries(replacements).reduce((text, [key, replacement]) => {
    return text.replaceAll(`{${key}}`, String(replacement))
  }, value)
}

const getTranslationsForLanguage = (languageCode) => {
  return { ...TRANSLATIONS[DEFAULT_LANGUAGE_CODE], ...(TRANSLATIONS[languageCode] || {}) }
}

const LABELS = [
  { id: 'general', textKey: 'labelGeneral', color: '#374151' },
  { id: 'priority', textKey: 'labelPriority', color: '#ef4444' },
  { id: 'work', textKey: 'labelWork', color: '#2563eb' },
  { id: 'life', textKey: 'labelLife', color: '#f97316' },
  { id: 'health', textKey: 'labelHealth', color: '#16a34a' },
  { id: 'finance', textKey: 'labelFinance', color: '#eab308' },
  { id: 'family', textKey: 'labelFamily', color: '#f472b6' },
  { id: 'home', textKey: 'labelHome', color: '#a3e635' },
  { id: 'errands', textKey: 'labelErrands', color: '#38bdf8' },
  { id: 'school', textKey: 'labelSchool', color: '#a855f7' },
  { id: 'event', textKey: 'labelEvent', color: '#db2777' },
  { id: 'travel', textKey: 'labelTravel', color: '#a16207' },
]

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

const RECURRING_MENU_OPTIONS = ['none', 'daily', 'weekly', 'weekdays']

const SWIPE_THRESHOLD = 70
const SWIPE_COMMIT_DELAY_MS = 170
const TOAST_DURATION_MS = 1800
const MAX_TASK_DESCRIPTION_LENGTH = 200
const TIME_OPTION_INTERVAL_MINUTES = 30
const TIME_OPTIONS_COUNT = (24 * 60) / TIME_OPTION_INTERVAL_MINUTES
const ALL_DAY_TASKS_SORT_LAST = '99:99:99'
const MIN_DATE_TIME_PICKER_HEIGHT = 132
const SPEECH_LANGUAGE_FALLBACKS = {
  'en-US': ['en-US', 'en'],
  'en-GB': ['en-GB', 'en-US', 'en'],
  'zh-CN': ['zh-CN', 'zh-Hans-CN', 'zh-Hans'],
  'ja-JP': ['ja-JP', 'ja'],
  'ko-KR': ['ko-KR', 'ko'],
  'fr-FR': ['fr-FR', 'fr'],
  'es-ES': ['es-ES', 'es'],
  'it-IT': ['it-IT', 'it'],
}

const createId = () => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const toISODateInTimeZone = (date, timeZone) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const getSupportedTimeZone = (timeZoneCandidate) => {
  return TIMEZONE_OPTIONS.includes(timeZoneCandidate)
    ? timeZoneCandidate
    : TIMEZONE_OPTIONS[0]
}

const getDefaultTimeZone = () => {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return getSupportedTimeZone(browserTimeZone)
}

const getISODateFromTimestampInTimeZone = (timestamp, timeZone) => {
  if (!Number.isFinite(timestamp)) {
    return null
  }

  return toISODateInTimeZone(new Date(timestamp), timeZone)
}

const getDatePartFromDueDateTime = (dueDate) => String(dueDate || '').slice(0, 10)

const getDueTimePart = (dueDate) => {
  const match = String(dueDate || '').match(/T(\d{2}:\d{2}:\d{2})$/)
  return match ? match[1] : taskModel.allDayTime
}

const makeDueDateTime = (datePart, timePart = taskModel.allDayTime) => {
  return `${datePart}T${timePart || taskModel.allDayTime}`
}

const isAllDayDueDate = (dueDate) => getDueTimePart(dueDate) === taskModel.allDayTime

const hasExplicitDueTime = (dueDate) => !isAllDayDueDate(dueDate)

const replaceDueDatePart = (dueDate, datePart) => {
  return makeDueDateTime(datePart, getDueTimePart(dueDate))
}

const getCurrentYearFromDatePart = (datePart) => datePart.slice(0, 4)

const formatDateLabel = (dueDate, locale, today) => {
  const datePart = getDatePartFromDueDateTime(dueDate)
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(getCurrentYearFromDatePart(datePart) === getCurrentYearFromDatePart(today) ? {} : { year: 'numeric' }),
  })
  return formatter.format(new Date(`${datePart}T00:00:00Z`))
}

const getValidClockTimeParts = (timePart) => {
  const [hoursRaw, minutes] = timePart.split(':')
  const hours = Number(hoursRaw)
  const minuteNumber = Number(minutes)
  if (
    !Number.isFinite(hours)
    || hours < 0
    || hours > 23
    || !/^\d{2}$/.test(minutes || '')
    || !Number.isFinite(minuteNumber)
    || minuteNumber > 59
  ) {
    return null
  }

  return { hours, minutes }
}

const formatTimePart = (timePart, compact = false) => {
  const clockTime = getValidClockTimeParts(timePart)
  if (!clockTime) {
    return ''
  }

  const { hours, minutes } = clockTime
  const period = hours >= 12 ? 'pm' : 'am'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes}${compact ? '' : ' '}${period}`
}

const formatDueTime = (dueDate, compact = false) => {
  return formatTimePart(getDueTimePart(dueDate), compact)
}

const formatTaskTimeCompact = (dueDate, amSuffix = 'a', pmSuffix = 'p') => {
  const clockTime = getValidClockTimeParts(getDueTimePart(dueDate))
  if (!clockTime) {
    return ''
  }

  const { hours, minutes } = clockTime
  return `${hours % 12 || 12}:${minutes}${hours >= 12 ? pmSuffix : amSuffix}`
}

const formatDateTimeLabel = (dueDate, locale, today) => {
  const dateLabel = formatDateLabel(dueDate, locale, today)
  if (!hasExplicitDueTime(dueDate)) {
    return dateLabel
  }

  return `${dateLabel} • ${formatDueTime(dueDate, true)}`
}

const compareTasksByDueDate = (a, b, dateDirection = 'asc') => {
  const aDate = getDatePartFromDueDateTime(a.dueDate)
  const bDate = getDatePartFromDueDateTime(b.dueDate)
  if (aDate !== bDate) {
    return dateDirection === 'desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate)
  }

  const aTime = isAllDayDueDate(a.dueDate) ? ALL_DAY_TASKS_SORT_LAST : getDueTimePart(a.dueDate)
  const bTime = isAllDayDueDate(b.dueDate) ? ALL_DAY_TASKS_SORT_LAST : getDueTimePart(b.dueDate)
  const timeCompare = aTime.localeCompare(bTime)
  return timeCompare || b.createdAt - a.createdAt
}

const parseTimeInput = (value) => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized) {
    return taskModel.allDayTime
  }

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/)
  if (!match) {
    return null
  }

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
    return null
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null
    }
    hours = hours % 12
    if (meridiem === 'pm') {
      hours += 12
    }
  } else if (hours > 23) {
    return null
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

const getNextHalfHourDate = () => {
  const date = new Date()
  const minutes = date.getMinutes()
  const minutesToAdd = TIME_OPTION_INTERVAL_MINUTES - (minutes % TIME_OPTION_INTERVAL_MINUTES)
  date.setMinutes(minutes + minutesToAdd, 0, 0)
  return date
}

const buildTimeOptions = () => {
  const optionDate = getNextHalfHourDate()
  return Array.from({ length: TIME_OPTIONS_COUNT }, () => {
    const hours = optionDate.getHours()
    const minutes = optionDate.getMinutes()
    const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    const label = formatTimePart(value)
    optionDate.setMinutes(optionDate.getMinutes() + TIME_OPTION_INTERVAL_MINUTES)
    return { value, label }
  })
}

const addDaysToISODate = (isoDate, daysToAdd) => {
  const date = new Date(`${getDatePartFromDueDateTime(isoDate)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  date.setUTCDate(date.getUTCDate() + daysToAdd)
  return date.toISOString().slice(0, 10)
}

const parseISODate = (isoDate) => {
  const date = new Date(`${getDatePartFromDueDateTime(isoDate)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const getNextWeekdayISODate = (isoDate) => {
  const date = parseISODate(isoDate)
  if (!date) {
    return isoDate
  }

  for (let attempt = 0; attempt < 7; attempt += 1) {
    date.setUTCDate(date.getUTCDate() + 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) {
      return date.toISOString().slice(0, 10)
    }
  }

  return isoDate
}

const getNextRecurringDate = (isoDate, recurringRule) => {
  const currentTime = getDueTimePart(isoDate)
  const withCurrentTime = (datePart) => makeDueDateTime(datePart, currentTime)

  if (recurringRule === 'daily') {
    return withCurrentTime(addDaysToISODate(isoDate, 1))
  }

  if (recurringRule === 'weekly') {
    return withCurrentTime(addDaysToISODate(isoDate, 7))
  }

  if (recurringRule === 'weekdays') {
    return withCurrentTime(getNextWeekdayISODate(isoDate))
  }

  return isoDate
}

const getSeriesId = (task) => task.originalTaskId || task.id

const getLabelByColor = (color) => {
  return LABELS.find((label) => label.color === color) || LABELS[0]
}

const toastVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
}

const syncService = {
  isAuthenticated: () => false,
  pullRemoteTasks: async () => [],
  pushMergedTasks: async () => {},
}

const getSupportedLanguage = (languageCodeCandidate) => {
  if (typeof languageCodeCandidate !== 'string') {
    return DEFAULT_LANGUAGE_CODE
  }

  const normalizedCandidate = languageCodeCandidate.trim()
  if (!normalizedCandidate) {
    return DEFAULT_LANGUAGE_CODE
  }

  const exact = LANGUAGE_OPTIONS.find((option) => option.code === normalizedCandidate)
  if (exact) {
    return exact.code
  }

  const candidatePrefix = normalizedCandidate.split('-')[0].toLowerCase()
  const prefixMatch = LANGUAGE_OPTIONS.find((option) => option.code.split('-')[0].toLowerCase() === candidatePrefix)
  if (prefixMatch) {
    return prefixMatch.code
  }

  return DEFAULT_LANGUAGE_CODE
}

const getDefaultLanguage = () => {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE_CODE
  }

  return getSupportedLanguage(navigator.language)
}

const getSpeechLanguageCandidates = (preferredLocale) => {
  const candidates = new Set()
  const configuredCandidates = SPEECH_LANGUAGE_FALLBACKS[preferredLocale] || [preferredLocale]
  configuredCandidates.forEach((candidate) => {
    if (typeof candidate === 'string' && candidate.trim()) {
      candidates.add(candidate.trim())
    }
  })

  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.trim()) {
    candidates.add(navigator.language.trim())
  }

  candidates.add(DEFAULT_LANGUAGE_CODE)
  return Array.from(candidates)
}

function App() {
  const defaultTimeZone = getDefaultTimeZone()
  const defaultLanguage = getDefaultLanguage()
  const [isReady, setIsReady] = useState(false)
  const [tasks, setTasks] = useState([])
  const [activeTab, setActiveTab] = useState(TAB_KEYS.notDone)
  const [menuTaskId, setMenuTaskId] = useState(null)
  const [labelSelectorTaskId, setLabelSelectorTaskId] = useState(null)
  const [isTimezoneMenuOpen, setIsTimezoneMenuOpen] = useState(false)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [selectedTimeZone, setSelectedTimeZone] = useState(defaultTimeZone)
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage)
  const [nowTick, setNowTick] = useState(() => taskModel.getNow())
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 390
    }

    return window.innerWidth
  })
  const [draftText, setDraftText] = useState('')
  const [draftDueDate, setDraftDueDate] = useState(() => makeDueDateTime(toISODateInTimeZone(new Date(), defaultTimeZone)))
  const [draftColor, setDraftColor] = useState(LABELS[0].color)
  const [isDraftDateAuto, setIsDraftDateAuto] = useState(true)
  const [isDraftLabelOpen, setIsDraftLabelOpen] = useState(false)
  const [isDraftRecurringMenuOpen, setIsDraftRecurringMenuOpen] = useState(false)
  const [draftRecurring, setDraftRecurring] = useState('none')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [editingModalAnchor, setEditingModalAnchor] = useState(null)
  const [frequencySelectorTaskId, setFrequencySelectorTaskId] = useState(null)
  const [isTaskMenuOpenUp, setIsTaskMenuOpenUp] = useState(false)
  const [isFrequencyMenuOpenUp, setIsFrequencyMenuOpenUp] = useState(false)
  const [swipeIntentByTaskId, setSwipeIntentByTaskId] = useState({})
  const [swipeCommitByTaskId, setSwipeCommitByTaskId] = useState({})
  const [toasts, setToasts] = useState([])
  const [swatchHint, setSwatchHint] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [dateTimePicker, setDateTimePicker] = useState(null)
  const [timeMenuOpen, setTimeMenuOpen] = useState(false)
  const isMobileViewport = viewportWidth <= 640
  const isSpeechSupported = Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition)

  const toastTimeoutsRef = useRef(new Map())
  const longPressBubbleRef = useRef(null)
  const swatchHintTimeoutRef = useRef(null)
  const longPressTextRef = useRef(null)
  const taskMenuButtonRefs = useRef(new Map())
  const editModalInputRef = useRef(null)
  const draftTextInputRef = useRef(null)
  const swipeCommitTimeoutsRef = useRef(new Map())
  const textRefs = useRef(new Map())
  const mirrorLegacyRef = useRef(false)
  const speechRecognitionRef = useRef(null)
  const languageMenu = useMemo(() => {
    return LANGUAGE_OPTIONS.map((option) => {
      const langText = getTranslationsForLanguage(option.code)
      return {
        ...option,
        displayName: langText.languageName || option.code,
      }
    })
  }, [])
  const activeLanguage = useMemo(() => {
    return languageMenu.find((option) => option.code === selectedLanguage) || languageMenu[0]
  }, [languageMenu, selectedLanguage])
  const text = useMemo(() => {
    return getTranslationsForLanguage(selectedLanguage)
  }, [selectedLanguage])
  const translate = (key, replacements) => {
    const translated = text[key] || TRANSLATIONS[DEFAULT_LANGUAGE_CODE][key]
    if (!translated && import.meta.env.DEV) {
      console.warn(`Missing translation key '${key}' for language '${selectedLanguage}'`)
    }
    return interpolateText(translated || key, replacements)
  }
  const recurringMenuOptions = RECURRING_MENU_OPTIONS.map((value) => {
    if (value === 'none') {
      return { value, label: translate('doesNotRepeat') }
    }

    if (value === 'daily') {
      return { value, label: translate('repeatDaily') }
    }

    if (value === 'weekly') {
      return { value, label: translate('repeatWeekly') }
    }

    return { value, label: translate('repeatWeekdays') }
  })
  const timeOptions = useMemo(() => dateTimePicker ? buildTimeOptions() : [], [dateTimePicker])
  const parsedPickerTime = dateTimePicker ? parseTimeInput(dateTimePicker.timeText) : null

  const getShouldOpenUp = (anchorElement, estimatedHeight = 240) => {
    if (!anchorElement) {
      return false
    }

    const rect = anchorElement.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const canFitBelow = spaceBelow >= estimatedHeight
    return !canFitBelow
  }

  const cancelEditTask = () => {
    setEditingTaskId(null)
    setEditingText('')
    setEditingModalAnchor(null)
  }

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      const result = await taskStorage.initialize(defaultTimeZone)
      if (!isMounted) {
        return
      }

      mirrorLegacyRef.current = result.fallbackActive
      setTasks(result.tasks)
      setSelectedTimeZone(getSupportedTimeZone(result.settings.timezone || defaultTimeZone))
      setSelectedLanguage(getSupportedLanguage(result.settings.language || defaultLanguage))
      setIsReady(true)
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [defaultLanguage, defaultTimeZone])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(taskModel.getNow())
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return
      }

      if (!target.closest('.menu-wrap')) {
        setIsTimezoneMenuOpen(false)
      }
      if (!target.closest('.language-menu-wrap')) {
        setIsLanguageMenuOpen(false)
      }

      if (!target.closest('.task-menu-wrap')) {
        setMenuTaskId(null)
        setFrequencySelectorTaskId(null)
        setIsTaskMenuOpenUp(false)
        setIsFrequencyMenuOpenUp(false)
      }

      if (!target.closest('.label-select-wrap')) {
        setIsDraftLabelOpen(false)
      }

      if (!target.closest('.recurring-menu-wrap')) {
        setIsDraftRecurringMenuOpen(false)
      }

      if (!target.closest('.date-time-picker') && !target.closest('.date-time-trigger')) {
        setDateTimePicker(null)
        setTimeMenuOpen(false)
      }

      if (!target.closest('.task-label-selector-wrap')) {
        setLabelSelectorTaskId(null)
      }

      if (isMobileViewport && editingTaskId && !target.closest('.task-edit-modal')) {
        cancelEditTask()
      }

    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current
    const swipeCommitTimeouts = swipeCommitTimeoutsRef.current
    return () => {
      toastTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      if (swatchHintTimeoutRef.current) {
        window.clearTimeout(swatchHintTimeoutRef.current)
      }
      swipeCommitTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      const recognition = speechRecognitionRef.current
      if (recognition) {
        recognition.stop()
        speechRecognitionRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isMobileViewport || !editingTaskId || !editModalInputRef.current) {
      return
    }

    const input = editModalInputRef.current
    window.requestAnimationFrame(() => {
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    })
  }, [isMobileViewport, editingTaskId])

  const pushToast = (message) => {
    const id = createId()
    setToasts((prev) => [...prev, { id, message }])

    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimeoutsRef.current.delete(id)
    }, TOAST_DURATION_MS)

    toastTimeoutsRef.current.set(id, timeoutId)
  }

  const focusDraftTextInputToEnd = () => {
    const input = draftTextInputRef.current
    if (!input) {
      return
    }

    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }

  const showSwatchHint = (message, anchorRect) => {
    if (!anchorRect) {
      return
    }

    setSwatchHint({
      id: createId(),
      message,
      left: anchorRect.left + anchorRect.width / 2,
      top: Math.max(8, anchorRect.top - 8),
    })

    if (swatchHintTimeoutRef.current) {
      window.clearTimeout(swatchHintTimeoutRef.current)
    }

    swatchHintTimeoutRef.current = window.setTimeout(() => {
      setSwatchHint(null)
      swatchHintTimeoutRef.current = null
    }, 1300)
  }

  const stopSpeechToText = () => {
    const recognition = speechRecognitionRef.current
    if (!recognition) {
      setIsListening(false)
      return
    }

    recognition.stop()
    speechRecognitionRef.current = null
    setIsListening(false)
  }

  const startSpeechToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      pushToast(translate('speechUnsupportedToast'))
      return
    }

    const recognition = new SpeechRecognition()
    const languageCandidates = getSpeechLanguageCandidates(activeLanguage.locale)
    let languageIndex = 0
    let retryAttempts = 0
    let isRetryingLanguage = false

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = languageCandidates[languageIndex] || activeLanguage.locale

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()

      if (!transcript) {
        return
      }

      setDraftText((prev) => {
        const trimmedPrev = prev.trim()
        const next = trimmedPrev
          ? `${trimmedPrev} ${transcript}`
          : transcript
        return next.slice(0, MAX_TASK_DESCRIPTION_LENGTH)
      })
    }

    recognition.onerror = (event) => {
      const nextLanguageIndex = languageIndex + 1
      const hasNextLanguageCandidate = nextLanguageIndex < languageCandidates.length
      const shouldRetryWithFallbackLanguage = !isRetryingLanguage
        && event.error === 'language-not-supported'
        && hasNextLanguageCandidate
        && retryAttempts < languageCandidates.length - 1

      if (shouldRetryWithFallbackLanguage) {
        isRetryingLanguage = true
        languageIndex = nextLanguageIndex
        retryAttempts += 1
        recognition.lang = languageCandidates[languageIndex]
        if (import.meta.env.DEV) {
          console.warn('Speech language fallback', {
            from: languageCandidates[languageIndex - 1],
            to: recognition.lang,
          })
        }

        // Delay restart to the next task so the current error cycle fully settles first.
        window.setTimeout(() => {
          try {
            recognition.start()
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('Speech recognition fallback start failed', error)
            }
            pushToast(translate('speechFailedToast'))
          } finally {
            isRetryingLanguage = false
          }
        }, 0)
        return
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        pushToast(translate('micDeniedToast'))
      } else if (event.error !== 'aborted') {
        pushToast(translate('speechFailedToast'))
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null
      }
    }

    speechRecognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      recognition.onstart = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      speechRecognitionRef.current = null
      setIsListening(false)
      pushToast(translate('unableStartSpeechToast'))
    }
  }

  useEffect(() => {
    const syncOnReconnect = async () => {
      if (!syncService.isAuthenticated()) {
        return
      }

      try {
        const remoteTasks = await syncService.pullRemoteTasks()
        const merged = taskStorage.mergeForSync(tasks, remoteTasks, (localTask, remoteTask) => {
          if (import.meta.env.DEV) {
            console.warn('Equal timestamp conflict resolved with remote preference', {
              localTask,
              remoteTask,
            })
          }
        })

        setTasks(merged)
        await taskStorage.replaceAllTasks(merged, mirrorLegacyRef.current)
        await syncService.pushMergedTasks(merged)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Deferred sync failed', error)
        }
      }
    }

    window.addEventListener('online', syncOnReconnect)
    return () => window.removeEventListener('online', syncOnReconnect)
  }, [tasks])

  const today = useMemo(() => {
    return toISODateInTimeZone(new Date(nowTick), selectedTimeZone)
  }, [nowTick, selectedTimeZone])
  const tomorrow = useMemo(() => addDaysToISODate(today, 1), [today])

  const effectiveDraftDueDate = isDraftDateAuto ? makeDueDateTime(today) : draftDueDate

  const notDoneTasks = useMemo(() => {
    return tasks
      .filter((task) => !task.isDone && getDatePartFromDueDateTime(task.dueDate) <= today)
      .sort((a, b) => compareTasksByDueDate(a, b, 'desc'))
  }, [tasks, today])

  const doneTasks = useMemo(() => {
    return tasks
      .filter((task) => task.isDone)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  }, [tasks])

  const plannedTasks = useMemo(() => {
    const recurringSeriesSeen = new Set()
    return tasks
      .filter((task) => !task.isDone && getDatePartFromDueDateTime(task.dueDate) > today)
      .sort((a, b) => compareTasksByDueDate(a, b, 'asc'))
      .filter((task) => {
        if (task.recurring === 'none') {
          return true
        }

        const seriesId = getSeriesId(task)
        if (recurringSeriesSeen.has(seriesId)) {
          return false
        }

        recurringSeriesSeen.add(seriesId)
        return true
      })
  }, [tasks, today])

  const visibleTasks = useMemo(() => {
    if (activeTab === TAB_KEYS.done) {
      return doneTasks
    }

    if (activeTab === TAB_KEYS.planned) {
      return plannedTasks
    }

    return notDoneTasks
  }, [activeTab, doneTasks, notDoneTasks, plannedTasks])

  const tabCounts = {
    [TAB_KEYS.notDone]: notDoneTasks.length,
    [TAB_KEYS.done]: doneTasks.length,
    [TAB_KEYS.planned]: plannedTasks.length,
  }

  useEffect(() => {
    if (!isReady) {
      return
    }

    taskStorage.saveSettings(
      {
        timezone: selectedTimeZone,
        language: selectedLanguage,
        syncEnabled: false,
      },
      mirrorLegacyRef.current,
    )
  }, [isReady, selectedLanguage, selectedTimeZone])

  const persistTask = (task) => {
    taskStorage.saveTask(task, mirrorLegacyRef.current)
  }

  const getDateTimePickerPosition = (triggerElement) => {
    const viewportPadding = 8
    const pickerWidth = Math.min(320, viewportWidth - viewportPadding * 2)
    const rect = triggerElement.getBoundingClientRect()
    const preferredHeight = Math.min(330, window.innerHeight - viewportPadding * 2)
    const canOpenUp = rect.top > viewportPadding + MIN_DATE_TIME_PICKER_HEIGHT
    const openUp = getShouldOpenUp(triggerElement, preferredHeight) && canOpenUp
    const availableHeight = openUp
      ? rect.top - viewportPadding * 2
      : window.innerHeight - rect.bottom - viewportPadding * 2
    const maxHeight = Math.max(MIN_DATE_TIME_PICKER_HEIGHT, availableHeight)
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, viewportWidth - pickerWidth - viewportPadding),
    )

    return {
      left,
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      width: pickerWidth,
      transform: openUp ? 'translateY(-100%)' : '',
      maxHeight,
      timeOptionsMaxHeight: Math.max(96, maxHeight - 104),
    }
  }

  const openDateTimePicker = ({ target, task = null, triggerElement }) => {
    const dueDate = target === 'draft' ? effectiveDraftDueDate : task.dueDate
    setDateTimePicker({
      id: `${target}-${task?.id || 'new'}-${taskModel.getNow()}`,
      target,
      taskId: task?.id || null,
      date: getDatePartFromDueDateTime(dueDate),
      timeText: hasExplicitDueTime(dueDate) ? formatDueTime(dueDate) : '',
      position: getDateTimePickerPosition(triggerElement),
    })
    setTimeMenuOpen(false)
  }

  const applyDueDateTime = ({ target, taskId, dueDate }) => {
    if (target === 'draft') {
      setDraftDueDate(dueDate)
      setIsDraftDateAuto(false)
      return
    }

    updateTaskDate(taskId, dueDate)
  }

  const updatePickerDate = (date) => {
    if (!dateTimePicker || !date) {
      return
    }

    const dueDate = makeDueDateTime(date, parseTimeInput(dateTimePicker.timeText) || taskModel.allDayTime)
    setDateTimePicker((current) => current && {
      ...current,
      date,
    })
    applyDueDateTime({
      target: dateTimePicker.target,
      taskId: dateTimePicker.taskId,
      dueDate,
    })
  }

  const commitPickerTime = (timeText) => {
    if (!dateTimePicker) {
      return
    }

    const parsedTime = parseTimeInput(timeText)
    if (!parsedTime) {
      setDateTimePicker((current) => current && { ...current, timeText })
      return
    }

    const displayText = parsedTime === taskModel.allDayTime ? '' : formatTimePart(parsedTime)
    const dueDate = makeDueDateTime(dateTimePicker.date, parsedTime)
    setDateTimePicker((current) => current && { ...current, timeText: displayText })
    applyDueDateTime({
      target: dateTimePicker.target,
      taskId: dateTimePicker.taskId,
      dueDate,
    })
  }

  const updateTaskInState = (taskId, updater) => {
    const currentTask = tasks.find((task) => task.id === taskId)
    if (!currentTask) {
      return null
    }

    const nextTask = updater(currentTask)
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? nextTask : task)),
    )

    return nextTask
  }

  const addTask = (event) => {
    event.preventDefault()

    const text = draftText.trim()
    if (!text || !effectiveDraftDueDate) {
      return
    }

    const newTask = {
      id: createId(),
      text,
      dueDate: effectiveDraftDueDate,
      isDone: false,
      color: draftColor,
      createdAt: taskModel.getNow(),
      completedAt: null,
      recurring: taskModel.recurringValues.includes(draftRecurring) ? draftRecurring : 'none',
      originalTaskId: null,
      last_updated: taskModel.getNowIso(),
    }

    setTasks((prev) => [newTask, ...prev])
    persistTask(newTask)

    setDraftText('')
    setDraftDueDate(makeDueDateTime(today))
    setDraftColor(LABELS[0].color)
    setDraftRecurring('none')
    setIsDraftDateAuto(true)
    setIsDraftLabelOpen(false)
    setIsDraftRecurringMenuOpen(false)

    if (getDatePartFromDueDateTime(newTask.dueDate) > today) {
      setActiveTab(TAB_KEYS.planned)
    } else {
      setActiveTab(TAB_KEYS.notDone)
    }
  }

  const getLaterToast = (targetDate) => {
    const targetDatePart = getDatePartFromDueDateTime(targetDate)
    return targetDatePart === tomorrow ? translate('movedToTomorrow') : translate('movedToDate', { date: targetDatePart })
  }

  const toggleTaskDone = (task, isDone, options = {}) => {
    const { suppressDoneToast = false, suppressRecurringToast = false } = options
    const updatedTask = updateTaskInState(task.id, (currentTask) => {
      if (isDone && currentTask.recurring !== 'none') {
        return {
          ...currentTask,
          dueDate: getNextRecurringDate(currentTask.dueDate, currentTask.recurring),
          isDone: false,
          completedAt: null,
          last_updated: taskModel.getNowIso(),
        }
      }

      return {
        ...currentTask,
        isDone,
        completedAt: isDone ? taskModel.getNow() : null,
        last_updated: taskModel.getNowIso(),
      }
    })

    if (updatedTask) {
      persistTask(updatedTask)
    }

    if (
      isDone
      && updatedTask
      && !suppressDoneToast
      && (activeTab === TAB_KEYS.notDone || activeTab === TAB_KEYS.planned)
    ) {
      pushToast(translate('taskMarkedDone'))
    }

    if (isDone && task.recurring !== 'none' && updatedTask && !suppressRecurringToast) {
      pushToast(translate('movedToNextOccurrence'))
      setActiveTab(TAB_KEYS.notDone)
    }
  }

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setSwipeCommitByTaskId((prev) => {
      if (!prev[taskId]) {
        return prev
      }

      const next = { ...prev }
      delete next[taskId]
      return next
    })
    const commitTimeoutId = swipeCommitTimeoutsRef.current.get(taskId)
    if (commitTimeoutId) {
      window.clearTimeout(commitTimeoutId)
      swipeCommitTimeoutsRef.current.delete(taskId)
    }
    taskStorage.deleteTask(taskId, mirrorLegacyRef.current)
    setMenuTaskId(null)
    setLabelSelectorTaskId(null)
    setFrequencySelectorTaskId(null)
  }

  const updateTaskDate = (taskId, date) => {
    if (!date) {
      return
    }

    const updatedTask = updateTaskInState(taskId, (task) => ({
      ...task,
      dueDate: date,
      last_updated: taskModel.getNowIso(),
    }))

    if (updatedTask) {
      persistTask(updatedTask)
    }
  }

  const setTaskColor = (taskId, color) => {
    const updatedTask = updateTaskInState(taskId, (task) => ({
      ...task,
      color,
      last_updated: taskModel.getNowIso(),
    }))

    if (updatedTask) {
      persistTask(updatedTask)
    }

    setLabelSelectorTaskId(null)
    setMenuTaskId(null)
  }

  const switchTab = (tabKey) => {
    setActiveTab(tabKey)
    setMenuTaskId(null)
    setLabelSelectorTaskId(null)
    setFrequencySelectorTaskId(null)
    setIsTaskMenuOpenUp(false)
    setIsFrequencyMenuOpenUp(false)
  }

  const beginEditTask = (task) => {
    setEditingTaskId(task.id)
    setEditingText(task.text)
    setMenuTaskId(null)
    setFrequencySelectorTaskId(null)

    if (isMobileViewport) {
      const menuButton = taskMenuButtonRefs.current.get(task.id)
      if (menuButton) {
        const rect = menuButton.getBoundingClientRect()
        const modalWidth = Math.min(360, viewportWidth - 16)
        const modalLeft = Math.max(8, Math.min(rect.right - modalWidth, viewportWidth - modalWidth - 8))
        setEditingModalAnchor({
          left: modalLeft,
          top: Math.max(10, rect.top - 10),
          width: modalWidth,
        })
      }
    }
  }

  const saveEditTask = (taskId) => {
    const text = editingText.trim()
    if (!text) {
      setEditingTaskId(null)
      setEditingText('')
      setEditingModalAnchor(null)
      return
    }

    const updatedTask = updateTaskInState(taskId, (task) => ({
      ...task,
      text,
      last_updated: taskModel.getNowIso(),
    }))

    if (updatedTask) {
      persistTask(updatedTask)
    }

    setEditingTaskId(null)
    setEditingText('')
    setEditingModalAnchor(null)
  }

  const canSwipeRight = (task) => {
    return (activeTab === TAB_KEYS.notDone && !task.isDone) || (activeTab === TAB_KEYS.done && task.isDone)
  }

  const getSwipeTargetDate = (task) => {
    const recurringRule = task.recurring
    if (recurringRule === 'none') {
      return replaceDueDatePart(task.dueDate, tomorrow)
    }

    return getNextRecurringDate(task.dueDate, recurringRule)
  }

  const hasRecurringDuplicateAtDate = (task, targetDate) => {
    const taskSeriesId = getSeriesId(task)
    return tasks.some((candidate) => {
      if (candidate.id === task.id || candidate.isDone || getDatePartFromDueDateTime(candidate.dueDate) !== getDatePartFromDueDateTime(targetDate)) {
        return false
      }

      if (candidate.recurring !== task.recurring) {
        return false
      }

      return getSeriesId(candidate) === taskSeriesId
    })
  }

  const onTaskSwipe = (task, swipeDirection) => {
    if (swipeDirection === 'left') {
      if (task.isDone) {
        deleteTask(task.id)
        pushToast(translate('taskDeleted'))
      } else {
        toggleTaskDone(task, true, { suppressDoneToast: true, suppressRecurringToast: true })
        pushToast(translate('movedToDone'))
      }
      return
    }

    if (swipeDirection === 'right' && canSwipeRight(task)) {
      if (activeTab === TAB_KEYS.done && task.isDone) {
        const updatedTask = updateTaskInState(task.id, (currentTask) => ({
          ...currentTask,
          isDone: false,
          completedAt: null,
          last_updated: taskModel.getNowIso(),
        }))

        if (updatedTask) {
          persistTask(updatedTask)
        }
        return
      }

      const targetDate = getSwipeTargetDate(task)
      if (task.recurring !== 'none' && hasRecurringDuplicateAtDate(task, targetDate)) {
        pushToast(getLaterToast(targetDate))
        return
      }

      const updatedTask = updateTaskInState(task.id, (currentTask) => ({
        ...currentTask,
        dueDate: targetDate,
        last_updated: taskModel.getNowIso(),
      }))

      if (updatedTask) {
        persistTask(updatedTask)
        pushToast(translate('savedForTomorrow'))
      }
    }
  }

  const getSwipeCommitThreshold = () => {
    return Math.max(SWIPE_THRESHOLD, Math.floor(viewportWidth / 3))
  }

  const startSwipeCommit = (task, swipeDirection) => {
    setSwipeCommitByTaskId((prev) => {
      if (prev[task.id]) {
        return prev
      }

      return {
        ...prev,
        [task.id]: swipeDirection,
      }
    })

    setSwipeIntentByTaskId((prev) => ({
      ...prev,
      [task.id]: swipeDirection,
    }))

    const timeoutId = window.setTimeout(() => {
      swipeCommitTimeoutsRef.current.delete(task.id)
      onTaskSwipe(task, swipeDirection)
      setSwipeCommitByTaskId((prev) => {
        if (!prev[task.id]) {
          return prev
        }

        const next = { ...prev }
        delete next[task.id]
        return next
      })
      setSwipeIntentByTaskId((prev) => {
        if (!prev[task.id]) {
          return prev
        }

        const next = { ...prev }
        delete next[task.id]
        return next
      })
    }, SWIPE_COMMIT_DELAY_MS)

    swipeCommitTimeoutsRef.current.set(task.id, timeoutId)
  }

  const onTaskTextLongPress = (taskId) => {
    const textElement = textRefs.current.get(taskId)
    if (!textElement) {
      return
    }

    const textNode = textElement.firstChild
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return
    }

    const textValue = textNode.textContent || ''
    if (!textValue) {
      return
    }

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, textValue.length)

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const swipeRightHintLabel = (task) => {
    if (!canSwipeRight(task)) {
      return null
    }

    if (activeTab === TAB_KEYS.done) {
      return translate('undo')
    }

    return translate('saveForLater')
  }

  const rowShellMotionProps = {
    initial: false,
    transition: { duration: 0 },
  }

  const persistTaskBatch = ({ save = [], deleteIds = [] }) => {
    save.forEach((task) => {
      taskStorage.saveTask(task, mirrorLegacyRef.current)
    })
    deleteIds.forEach((taskId) => {
      taskStorage.deleteTask(taskId, mirrorLegacyRef.current)
    })
  }

  const changeTaskFrequency = (task, nextRecurring) => {
    const seriesId = getSeriesId(task)
    const nowIso = taskModel.getNowIso()
    const nowMs = taskModel.getNow()
    const nextDueDate = getNextRecurringDate(task.dueDate, nextRecurring)
    const futureSeriesTasks = tasks.filter((candidate) => {
      if (candidate.id === task.id || candidate.isDone) {
        return false
      }
      if (getDatePartFromDueDateTime(candidate.dueDate) <= today) {
        return false
      }
      return getSeriesId(candidate) === seriesId
    })
    const deleteIds = futureSeriesTasks.map((candidate) => candidate.id)
    const deleteIdsSet = new Set(deleteIds)
    let nextTasks = tasks.filter((candidate) => !deleteIdsSet.has(candidate.id))
    const selectedTask = nextTasks.find((candidate) => candidate.id === task.id)
    if (!selectedTask) {
      setMenuTaskId(null)
      setFrequencySelectorTaskId(null)
      return
    }

    const updatedSelectedTask = {
      ...selectedTask,
      recurring: nextRecurring,
      originalTaskId: nextRecurring === 'none' ? null : seriesId,
      last_updated: nowIso,
    }

    nextTasks = nextTasks.map((candidate) => {
      if (candidate.id !== task.id) {
        return candidate
      }
      return updatedSelectedTask
    })

    const save = [updatedSelectedTask]
    if (nextRecurring !== 'none' && getDatePartFromDueDateTime(updatedSelectedTask.dueDate) <= today) {
      const nextOccurrence = {
        id: createId(),
        text: updatedSelectedTask.text,
        dueDate: nextDueDate,
        isDone: false,
        color: updatedSelectedTask.color,
        createdAt: nowMs,
        completedAt: null,
        recurring: nextRecurring,
        originalTaskId: seriesId,
        last_updated: nowIso,
      }
      nextTasks = [nextOccurrence, ...nextTasks]
      save.push(nextOccurrence)
    }

    setTasks(nextTasks)
    persistTaskBatch({ save, deleteIds })
    setMenuTaskId(null)
    setFrequencySelectorTaskId(null)
  }

  const toggleTaskMenu = (taskId, triggerElement) => {
    setMenuTaskId((prev) => {
      if (prev === taskId) {
        setFrequencySelectorTaskId(null)
        setIsTaskMenuOpenUp(false)
        setIsFrequencyMenuOpenUp(false)
        return null
      }

      setFrequencySelectorTaskId(null)
      setIsTaskMenuOpenUp(getShouldOpenUp(triggerElement, 240))
      setIsFrequencyMenuOpenUp(false)
      return taskId
    })
  }

  const renderEmptyMessage = () => {
    if (activeTab === TAB_KEYS.done) {
      return translate('emptyDone')
    }

    if (activeTab === TAB_KEYS.planned) {
      return translate('emptyPlanned')
    }

    return translate('emptyNotDone')
  }

  if (!isReady) {
    return (
      <div className="app-shell loading-shell">
        <p>{translate('loading')}</p>
      </div>
    )
  }

  return (
    <div className="app-shell" lang={activeLanguage.locale}>
      <header className="top-nav">
        <div className="top-left">
          <div className="menu-wrap">
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsTimezoneMenuOpen((prev) => !prev)}
              aria-label={translate('openMenu')}
            >
              ☰
            </button>
            {isTimezoneMenuOpen ? (
              <div className="menu-popover">
                <label htmlFor="timezone-select">{translate('setTimeZone')}</label>
                <select
                  id="timezone-select"
                  value={selectedTimeZone}
                  onChange={(event) => {
                    setSelectedTimeZone(event.target.value)
                  }}
                >
                  {TIMEZONE_OPTIONS.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>
                      {timeZone}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <button type="button" className="brand-button" onClick={() => switchTab(TAB_KEYS.notDone)}>
            Duebly
          </button>
        </div>
        <div className="top-right">
          <div className="language-menu-wrap">
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsLanguageMenuOpen((prev) => !prev)}
              aria-label={translate('openLanguageMenu')}
              title={translate('chooseLanguage')}
            >
              {activeLanguage.flag}
            </button>
            {isLanguageMenuOpen ? (
              <div className="menu-popover language-popover">
                <label htmlFor="language-select">{translate('chooseLanguage')}</label>
                <select
                  id="language-select"
                  value={selectedLanguage}
                  onChange={(event) => {
                    setSelectedLanguage(event.target.value)
                    setIsLanguageMenuOpen(false)
                  }}
                >
                  {languageMenu.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.flag} {option.displayName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => window.alert(translate('loginMvpAlert'))}
          >
            {translate('login')}
          </button>
        </div>
      </header>

      {dateTimePicker ? (
        <div
          className="date-time-picker"
          role="dialog"
          aria-label={translate('dueDate')}
          style={{
            left: `${dateTimePicker.position.left}px`,
            top: `${dateTimePicker.position.top}px`,
            width: `${dateTimePicker.position.width}px`,
            transform: dateTimePicker.position.transform,
            maxHeight: `${dateTimePicker.position.maxHeight}px`,
            '--time-options-max-height': `${dateTimePicker.position.timeOptionsMaxHeight}px`,
          }}
        >
          <input
            type="date"
            value={dateTimePicker.date}
            onChange={(event) => {
              updatePickerDate(event.target.value)
            }}
            aria-label={translate('dueDate')}
          />
          <div className="time-picker-field">
            <input
              type="text"
              value={dateTimePicker.timeText}
              placeholder={translate('setTime')}
              onFocus={() => setTimeMenuOpen(true)}
              onClick={() => setTimeMenuOpen(true)}
              onChange={(event) => {
                const nextText = event.target.value
                setDateTimePicker((current) => current && { ...current, timeText: nextText })
                if (!nextText.trim()) {
                  commitPickerTime('')
                }
              }}
              onBlur={() => commitPickerTime(dateTimePicker.timeText)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitPickerTime(dateTimePicker.timeText)
                  setTimeMenuOpen(false)
                }
                if (event.key === 'Escape') {
                  setDateTimePicker(null)
                  setTimeMenuOpen(false)
                }
              }}
              role="combobox"
              aria-expanded={timeMenuOpen}
              aria-label={translate('setTime')}
            />
            {dateTimePicker.timeText ? (
              <button type="button" className="clear-time-button" onClick={() => commitPickerTime('')}>
                {translate('clearTime')}
              </button>
            ) : null}
            {timeMenuOpen ? (
              <div className="time-options" role="listbox">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={parsedPickerTime === option.value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      commitPickerTime(option.label)
                      setTimeMenuOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="tab-bar" aria-label={translate('taskListTabs')}>
        <button
          type="button"
          className={`tab-button ${activeTab === TAB_KEYS.notDone ? 'active' : ''}`}
          onClick={() => switchTab(TAB_KEYS.notDone)}
        >
          {translate('notDoneTab')} ({tabCounts[TAB_KEYS.notDone]})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === TAB_KEYS.done ? 'active' : ''}`}
          onClick={() => switchTab(TAB_KEYS.done)}
        >
          {translate('doneTab')} ({tabCounts[TAB_KEYS.done]})
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === TAB_KEYS.planned ? 'active' : ''}`}
          onClick={() => switchTab(TAB_KEYS.planned)}
        >
          {translate('plannedTab')} ({tabCounts[TAB_KEYS.planned]})
        </button>
      </nav>

      <main className="content">
        <section className="composer-card">
          <h1>{translate('addTaskTitle')}</h1>
          <form className="composer" onSubmit={addTask}>
            <div className="composer-text-row">
              <button
                type="button"
                className={`icon-button mic-trigger ${isListening ? 'listening' : ''}`}
                aria-label={isListening ? translate('stopSpeechToText') : translate('startSpeechToText')}
                title={isSpeechSupported ? translate('speakTaskDescription') : translate('speechNotSupportedTitle')}
                disabled={!isSpeechSupported}
                onClick={() => {
                  if (isListening) {
                    stopSpeechToText()
                    return
                  }

                  if (isMobileViewport) {
                    pushToast(translate('mobileMicKeyboardBetterToast'))
                    focusDraftTextInputToEnd()
                    return
                  }

                  startSpeechToText()
                }}
              >
                {isListening ? '🎙️' : '🎤'}
              </button>
              <label className="sr-only" htmlFor="new-task-text">
                {translate('taskDescription')}
              </label>
              <input
                ref={draftTextInputRef}
                id="new-task-text"
                type="text"
                placeholder={translate('taskDescription')}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                maxLength={MAX_TASK_DESCRIPTION_LENGTH}
                required
              />
            </div>
            <label className="sr-only" htmlFor="new-task-date">
              {translate('dueDate')}
            </label>
            <div className="composer-meta-row">
              <div className="recurring-menu-wrap">
                <button
                  type="button"
                  className={`icon-button recurring-trigger ${draftRecurring !== 'none' ? 'active' : ''}`}
                  aria-label={translate('setRecurringRule')}
                  onClick={() => setIsDraftRecurringMenuOpen((prev) => !prev)}
                >
                  ☰
                </button>
                {isDraftRecurringMenuOpen ? (
                  <div className="task-menu recurring-menu">
                    {recurringMenuOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={draftRecurring === option.value ? 'active' : ''}
                        aria-pressed={draftRecurring === option.value}
                        onClick={() => {
                          setDraftRecurring(option.value)
                          setIsDraftRecurringMenuOpen(false)
                        }}
                      >
                        <span>{option.label}</span>
                        <span className="recurring-option-check" aria-hidden="true">
                          {draftRecurring === option.value ? '✓' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                id="new-task-date"
                type="button"
                className="date-time-trigger composer-date-trigger"
                onClick={(event) => {
                  openDateTimePicker({
                    target: 'draft',
                    triggerElement: event.currentTarget,
                  })
                }}
              >
                {formatDateTimeLabel(effectiveDraftDueDate, activeLanguage.locale, today)}
              </button>
              <div className="label-select-wrap">
                <button
                  type="button"
                  className="label-trigger"
                  onClick={() => setIsDraftLabelOpen((prev) => !prev)}
                >
                  <span className="label-dot" style={{ backgroundColor: draftColor }} />
                  <span>{translate(getLabelByColor(draftColor).textKey)}</span>
                </button>
                {isDraftLabelOpen ? (
                  <div className="label-dropdown">
                    {LABELS.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        className="label-option"
                        onClick={() => {
                          setDraftColor(label.color)
                          setIsDraftLabelOpen(false)
                        }}
                      >
                        <span className="label-dot" style={{ backgroundColor: label.color }} />
                        <span>{translate(label.textKey)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <button type="submit" className="primary-button" disabled={!draftText.trim() || !effectiveDraftDueDate}>
              {translate('addTask')}
            </button>
          </form>
          <p className="today-label">
            {translate('today')} ({selectedTimeZone}): <strong>{today}</strong>
          </p>
        </section>

        <section className="task-list" aria-live="polite">
          {visibleTasks.length === 0 ? <p className="empty-state">{renderEmptyMessage()}</p> : null}

            <AnimatePresence initial={false}>
            {visibleTasks.map((task) => {
              const label = getLabelByColor(task.color)
              const commitDirection = swipeCommitByTaskId[task.id] || null
              const swipeIntent = swipeIntentByTaskId[task.id] || null
              const isCommitInProgress = Boolean(commitDirection)
              const swipeDragLimit = Math.max(100, getSwipeCommitThreshold() + 20)
              const activeSwipe = commitDirection || swipeIntent
              const swipeClass = activeSwipe === 'left'
                ? task.isDone
                  ? 'delete'
                  : 'move-done'
                : activeSwipe === 'right'
                  ? activeTab === TAB_KEYS.done
                    ? 'undo'
                    : 'save-later'
                  : ''
              const swipeText = activeSwipe === 'left'
                ? task.isDone
                  ? translate('delete')
                  : translate('markAsDone')
                : activeSwipe === 'right' && canSwipeRight(task)
                  ? swipeRightHintLabel(task)
                  : ''
              const rowShellClassName =
                menuTaskId === task.id || frequencySelectorTaskId === task.id || labelSelectorTaskId === task.id
                  ? 'task-row-shell menu-open'
                  : 'task-row-shell'
              const hasTaskTime = hasExplicitDueTime(task.dueDate)

              return (
                <motion.div
                  key={task.id}
                  className={rowShellClassName}
                  {...rowShellMotionProps}
                >
                  <div className={`swipe-hint ${activeSwipe ? 'show' : ''} ${swipeClass}`}>
                    <span>{swipeText}</span>
                  </div>

                  <motion.article
                    className="task-row"
                    drag={isCommitInProgress ? false : 'x'}
                    dragDirectionLock
                    dragConstraints={{ left: -swipeDragLimit, right: swipeDragLimit }}
                    dragElastic={0.08}
                    dragMomentum={false}
                    dragSnapToOrigin
                    dragTransition={{ bounceStiffness: 700, bounceDamping: 38 }}
                    style={{ touchAction: 'pan-y' }}
                    animate={
                      commitDirection === 'left'
                        ? { x: `-${Math.max(320, viewportWidth)}px`, opacity: 0 }
                        : commitDirection === 'right'
                          ? { x: `${Math.max(320, viewportWidth)}px`, opacity: 0 }
                          : { x: 0, opacity: 1 }
                    }
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    onDragEnd={(event, info) => {
                      setSwipeIntentByTaskId((prev) => {
                        if (!prev[task.id]) {
                          return prev
                        }

                        const next = { ...prev }
                        delete next[task.id]
                        return next
                      })

                      if (isCommitInProgress) {
                        return
                      }

                      const commitThreshold = getSwipeCommitThreshold()
                      const absOffset = Math.abs(info.offset.x)
                      if (absOffset < commitThreshold) {
                        return
                      }

                      const swipeDirection = info.offset.x < 0 ? 'left' : 'right'
                      if (swipeDirection === 'right' && !canSwipeRight(task)) {
                        return
                      }

                      startSwipeCommit(task, swipeDirection)
                    }}
                    onDrag={(event, info) => {
                      if (isCommitInProgress) {
                        return
                      }

                      const nextIntent = info.offset.x <= -12 ? 'left' : info.offset.x >= 12 && canSwipeRight(task) ? 'right' : null
                      setSwipeIntentByTaskId((prev) => {
                        const current = prev[task.id] || null
                        if (current === nextIntent) {
                          return prev
                        }

                        if (!nextIntent) {
                          if (!prev[task.id]) {
                            return prev
                          }

                          const next = { ...prev }
                          delete next[task.id]
                          return next
                        }

                        return {
                          ...prev,
                          [task.id]: nextIntent,
                        }
                      })
                    }}
                  >
                    <button
                      className="task-date date-time-trigger"
                      type="button"
                      onClick={(event) => {
                        openDateTimePicker({
                          target: 'task',
                          task,
                          triggerElement: event.currentTarget,
                        })
                      }}
                      aria-label={translate('changeDateAria', { task: task.text })}
                    >
                      {formatDateLabel(task.dueDate, activeLanguage.locale, today)}
                    </button>

                    <button
                      type="button"
                      className="task-color"
                      title={translate(label.textKey)}
                      style={{ backgroundColor: task.color }}
                      aria-label={translate('labelAria', { label: translate(label.textKey) })}
                      onTouchStart={(event) => {
                        const swatchRect = event.currentTarget.getBoundingClientRect()
                        longPressBubbleRef.current = window.setTimeout(() => {
                          showSwatchHint(translate(label.textKey), swatchRect)
                        }, 450)
                      }}
                      onTouchEnd={() => {
                        if (longPressBubbleRef.current) {
                          window.clearTimeout(longPressBubbleRef.current)
                          longPressBubbleRef.current = null
                        }
                      }}
                      onTouchCancel={() => {
                        if (longPressBubbleRef.current) {
                          window.clearTimeout(longPressBubbleRef.current)
                          longPressBubbleRef.current = null
                        }
                      }}
                    />

                    {hasTaskTime ? (
                      <span className="task-time">
                        {formatTaskTimeCompact(task.dueDate, translate('timeAmAbbrev'), translate('timePmAbbrev'))}
                      </span>
                    ) : null}

                    <div className="task-main">
                      {editingTaskId === task.id && !isMobileViewport ? (
                        <input
                          className="task-edit-input"
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          onBlur={() => saveEditTask(task.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              saveEditTask(task.id)
                            }
                            if (event.key === 'Escape') {
                              cancelEditTask()
                            }
                          }}
                          ref={(element) => {
                            if (!element) {
                              return
                            }
                            window.requestAnimationFrame(() => {
                              element.focus()
                              const end = element.value.length
                              element.setSelectionRange(end, end)
                            })
                          }}
                        />
                      ) : (
                        <p
                          className={`task-text ${task.isDone ? 'done' : ''}`}
                          ref={(element) => {
                            if (element) {
                              textRefs.current.set(task.id, element)
                            } else {
                              textRefs.current.delete(task.id)
                            }
                          }}
                          onPointerDown={() => {
                            longPressTextRef.current = window.setTimeout(() => {
                              onTaskTextLongPress(task.id)
                            }, 450)
                          }}
                          onPointerUp={() => {
                            if (longPressTextRef.current) {
                              window.clearTimeout(longPressTextRef.current)
                            }
                          }}
                          onPointerLeave={() => {
                            if (longPressTextRef.current) {
                              window.clearTimeout(longPressTextRef.current)
                            }
                          }}
                        >
                          {task.text}
                          {task.recurring !== 'none' ? (
                            <span className="recurring-badge" aria-label={translate('recurringTask')}>
                              {' '}↻ {translate('recurringBadge')}
                            </span>
                          ) : null}
                        </p>
                      )}
                    </div>

                    <div className="task-menu-wrap">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={(event) => toggleTaskMenu(task.id, event.currentTarget)}
                        aria-label={translate('openTaskMenuAria', { task: task.text })}
                        ref={(element) => {
                          if (element) {
                            taskMenuButtonRefs.current.set(task.id, element)
                          } else {
                            taskMenuButtonRefs.current.delete(task.id)
                          }
                        }}
                      >
                        ⋯
                      </button>
                      {menuTaskId === task.id ? (
                        <div className={`task-menu ${isTaskMenuOpenUp ? 'open-up' : ''}`}>
                          {!task.isDone ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuTaskId(null)
                                setFrequencySelectorTaskId(null)
                                toggleTaskDone(task, true)
                              }}
                            >
                              {translate('markAsDone')}
                            </button>
                          ) : null}
                          <button type="button" onClick={() => beginEditTask(task)}>
                            {translate('editTask')}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              setFrequencySelectorTaskId((prev) => {
                                const next = prev === task.id ? null : task.id
                                setIsFrequencyMenuOpenUp(next ? getShouldOpenUp(event.currentTarget, 200) : false)
                                return next
                              })
                            }}
                          >
                            {translate('changeFrequency')}
                          </button>
                          {frequencySelectorTaskId === task.id ? (
                            <div className={`task-frequency-submenu ${isFrequencyMenuOpenUp ? 'open-up' : ''}`}>
                              {recurringMenuOptions.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => changeTaskFrequency(task, option.value)}
                                >
                                  <span>{option.label}</span>
                                  <span className="recurring-option-check" aria-hidden="true">
                                    {task.recurring === option.value ? '✓' : ''}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setLabelSelectorTaskId(task.id)
                              setMenuTaskId(null)
                              setFrequencySelectorTaskId(null)
                            }}
                          >
                            {translate('changeLabel')}
                          </button>
                          <button type="button" onClick={() => deleteTask(task.id)}>
                            {translate('deleteTask')}
                          </button>
                        </div>
                      ) : null}
                    </div>

                  </motion.article>

                  {labelSelectorTaskId === task.id ? (
                    <div className="task-label-selector-wrap">
                      <div className="task-label-selector">
                        {LABELS.map((item) => (
                          <button key={item.id} type="button" onClick={() => setTaskColor(task.id, item.color)}>
                            <span className="label-dot" style={{ backgroundColor: item.color }} />
                            <span>{translate(item.textKey)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )
            })}
            </AnimatePresence>
        </section>
      </main>

      <div className="toast-layer" aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className="toast"
              variants={toastVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.16 }}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {swatchHint ? (
          <motion.div
            key={swatchHint.id}
            className="swatch-hint"
            style={{ left: swatchHint.left, top: swatchHint.top }}
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.14 }}
            aria-hidden="true"
          >
            {swatchHint.message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isMobileViewport && editingTaskId ? (
        <div
          className="task-edit-modal"
          style={
            editingModalAnchor
              ? {
                left: editingModalAnchor.left,
                top: editingModalAnchor.top,
                width: editingModalAnchor.width,
              }
              : undefined
          }
        >
          <label className="sr-only" htmlFor="task-edit-modal-input">
            {translate('editTaskDescription')}
          </label>
          <input
            id="task-edit-modal-input"
            ref={editModalInputRef}
            className="task-edit-modal-input"
            value={editingText}
            onChange={(event) => setEditingText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                saveEditTask(editingTaskId)
              }
              if (event.key === 'Escape') {
                cancelEditTask()
              }
            }}
          />
          <div className="task-edit-modal-actions">
            <button type="button" className="ghost-button" onClick={cancelEditTask}>
              {translate('cancel')}
            </button>
            <button type="button" className="primary-button" onClick={() => saveEditTask(editingTaskId)}>
              {translate('save')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
