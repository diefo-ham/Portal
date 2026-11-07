/**
 * Spanish text for the PAA portal, keyed by the English the screens are written
 * in (see i18n.tsx). `{name}` marks a value filled in at run time. A test checks
 * that every phrase the screens pass to `t` has an entry here.
 */
export const es: Record<string, string> = {
  // Navigation and shell
  Practice: "Práctica",
  Review: "Repaso",
  Browse: "Explorar",
  Tests: "Pruebas",
  "Test mode": "Modo de prueba",
  Settings: "Ajustes",
  "Main navigation": "Navegación principal",
  "Test: {name}": "Prueba: {name}",
  "Choose a test": "Elige una prueba",
  "Switch to {other}": "Cambiar a {other}",
  "· any if none is selected": "· cualquiera si no eliges",
  "Dismiss error": "Cerrar el error",
  "Dismiss message": "Cerrar el mensaje",
  "A new version of the portal is ready.":
    "Hay una versión nueva del portal lista.",
  "Reload to update": "Recargar para actualizar",
  "Made for focused, independent study.":
    "Hecho para estudiar con calma y por tu cuenta.",
  "Personal practice · Not affiliated with College Board":
    "Práctica personal · Sin relación con el College Board",
  SAT: "SAT",

  // Home
  "YOUR PRACTICE": "TU PRÁCTICA",
  "What would you like to work on?": "¿En qué quieres trabajar?",
  "Choose a focus, settle in, and take it one question at a time.":
    "Elige un tema, ponte cómodo y ve una pregunta a la vez.",
  "Add your questions to begin.": "Agrega tus preguntas para empezar.",
  "This portal comes with no questions. Add your own College Board question PDFs and they are prepared on this device; nothing is uploaded.":
    "Este portal no trae preguntas. Agrega tus propios PDF de preguntas y se preparan en este dispositivo; no se envía nada.",
  "Add your question PDFs": "Agrega tus PDF de preguntas",
  "Practice selection": "Selección de práctica",
  "Choose your focus": "Elige tu enfoque",
  "Reset filters": "Restablecer filtros",
  "Refine selection": "Afinar la selección",
  " · customized": " · personalizada",
  "Search carried over from Browse: {search}":
    "Búsqueda traída de Explorar: {search}",
  "Clear search": "Borrar la búsqueda",
  "Session size": "Tamaño de la sesión",
  "Start practice →": "Empezar a practicar →",
  "Max {n}": "Máx. {n}",
  "No questions available": "No hay preguntas disponibles",
  "No questions match or remain for these filters. Change the filters, or reset relevant study progress in Settings to restore availability when appropriate.":
    "No hay preguntas que coincidan o que queden con estos filtros. Cambia los filtros o, si procede, reinicia el progreso en Ajustes para volver a tenerlas disponibles.",
  "Something to revisit": "Algo para repasar",
  "{n} questions could use another attempt.":
    "{n} preguntas merecen otro intento.",
  "{n} questions from your practice sets are still unanswered.":
    "{n} preguntas de tus sesiones siguen sin contestar.",
  "See what’s waiting in Review →": "Mira qué te espera en Repaso →",
  "Browse individual questions →": "Explorar preguntas una por una →",

  // Filters
  Section: "Sección",
  Test: "Parte",
  All: "Todas",
  Domain: "Dominio",
  Skill: "Destreza",
  Difficulty: "Dificultad",
  "Any difficulty": "Cualquier dificultad",
  "Answer status": "Estado de la respuesta",
  "All questions": "Todas las preguntas",
  Mistakes: "Errores",
  Unanswered: "Sin contestar",
  Completed: "Completadas",
  Easy: "Fácil",
  Medium: "Media",
  Hard: "Difícil",
  easy: "fácil",
  medium: "media",
  hard: "difícil",
  "Bookmarked only": "Solo con marcador",
  "Any {label}": "Cualquier {label}",
  "1 selected": "1 seleccionado",
  "{n} selected": "{n} seleccionados",
  "Find {label}": "Buscar {label}",
  "Find…": "Buscar…",
  "No options in this selection.": "No hay opciones en esta selección.",
  "Clear {label}": "Borrar {label}",
  Done: "Listo",

  // Practice
  "← Exit": "← Salir",
  "Open question overview": "Abrir el resumen de preguntas",
  "Question {n}": "Pregunta {n}",
  "of {total}": "de {total}",
  "Time on this question": "Tiempo en esta pregunta",
  "Practice tools": "Herramientas de práctica",
  "Remove bookmark": "Quitar el marcador",
  "Bookmark question": "Marcar la pregunta",
  "Remove bookmark (E)": "Quitar el marcador (E)",
  "Bookmark question (E)": "Marcar la pregunta (E)",
  "Question {id}": "Pregunta {id}",
  "Select an answer from the choices shown above.":
    "Selecciona una respuesta entre las opciones de arriba.",
  "Enter your answer below.": "Escribe tu respuesta abajo.",
  "Your answer": "Tu respuesta",
  "Your numeric answer": "Tu respuesta numérica",
  "Enter a number or fraction": "Escribe un número o una fracción",
  "Positive numbers only, up to 4 characters (for example, 7.5 or 15/2). Mixed numbers are not accepted.":
    "Solo números positivos, de hasta 4 caracteres (por ejemplo, 7.5 o 15/2). No se aceptan números mixtos.",
  "Decimals and fractions accepted (for example, 0.5 or 1/2).":
    "Se aceptan decimales y fracciones (por ejemplo, 0.5 o 1/2).",
  "Enter a valid number or fraction with a nonzero denominator.":
    "Escribe un número válido o una fracción con denominador distinto de cero.",
  "Check answer": "Comprobar la respuesta",
  "Correct. Nicely done.": "Correcto. ¡Bien hecho!",
  "Not quite. Let’s work through it.": "Todavía no. Vamos a analizarlo.",
  "Correct answer:": "Respuesta correcta:",
  "Correct answer: {answer}": "Respuesta correcta: {answer}",
  " or ": " o ",
  "View explanation": "Ver la explicación",
  Explanation: "Explicación",
  "No rationale was included in this import.":
    "Esta importación no incluyó explicación.",
  "Your answer: {answer}": "Tu respuesta: {answer}",
  "← Previous": "← Anterior",
  "Next question →": "Siguiente pregunta →",
  "Skip for now →": "Saltar por ahora →",
  "Review session →": "Revisar la sesión →",
  "Back to Practice tools": "Volver a las herramientas de práctica",
  Back: "Atrás",
  "Question overview": "Resumen de preguntas",
  "Question details": "Detalles de la pregunta",
  "Leave this session?": "¿Salir de esta sesión?",
  "Close panel": "Cerrar el panel",
  "Your work is saved. You can resume this session from Practice.":
    "Tu trabajo está guardado. Puedes retomar esta sesión desde Práctica.",
  Cancel: "Cancelar",
  "Leave session": "Salir de la sesión",
  "Keyboard shortcuts & help": "Atajos de teclado y ayuda",
  "Show timer": "Mostrar el cronómetro",
  "Resume timer": "Reanudar el cronómetro",
  "Pause timer": "Pausar el cronómetro",
  "Finish session": "Terminar la sesión",
  "Session map": "Mapa de la sesión",
  "Go to question {n}": "Ir a la pregunta {n}",
  ", answered": ", contestada",
  ", correct": ", correcta",
  ", incorrect": ", incorrecta",
  "Filled squares are answered. You can skip and return.":
    "Los cuadros rellenos están contestados. Puedes saltar y volver.",
  "Difficulty: {difficulty}": "Dificultad: {difficulty}",
  Unspecified: "Sin especificar",
  "Skill unspecified": "Destreza sin especificar",
  "Source unspecified": "Fuente sin especificar",
  "PDF source details": "Detalles del PDF de origen",
  "{file} · pages {pages}": "{file} · páginas {pages}",
  "Original layout is shown above. Search text was extracted automatically and may omit math notation.":
    "Arriba se muestra el diseño original. El texto de búsqueda se extrajo automáticamente y puede omitir la notación matemática.",
  "Previous / next question": "Pregunta anterior / siguiente",
  "Choose answer A–D (letters also work while reading)":
    "Elegir la respuesta A–D (también sirven las letras mientras lees)",
  "Check your answer; after feedback, advance or review the session":
    "Comprobar tu respuesta; después de ver el resultado, avanzar o revisar la sesión",
  "Toggle the current question’s bookmark":
    "Marcar o desmarcar la pregunta actual",
  "Close a temporary panel first. While reading, open Leave session; press Escape again to leave.":
    "Primero cierra un panel temporal. Mientras lees, abre «Salir de la sesión»; pulsa Escape otra vez para salir.",
  "Shortcuts apply while reading. Focused controls keep their normal keys; Enter also submits a selected answer choice or numeric answer. Use Tab to reach controls and Space to activate them.":
    "Los atajos funcionan mientras lees. Los controles enfocados conservan sus teclas normales; Enter también envía la opción elegida o la respuesta numérica. Usa Tab para llegar a los controles y Espacio para activarlos.",
  "Exit saves your place. Resume any unfinished set from Practice. Find saved questions in Review → Bookmarks. The question number opens the session map. Practice tools contain timing and question details.":
    "Salir guarda tu lugar. Retoma cualquier grupo sin terminar desde Práctica. Encuentra las preguntas marcadas en Repaso → Marcadores. El número de la pregunta abre el mapa de la sesión. Las herramientas de práctica incluyen el tiempo y los detalles de la pregunta.",
  "Loading original PDF content…": "Cargando el contenido original del PDF…",
  "Original PDF question": "Pregunta original del PDF",
  "Original PDF explanation": "Explicación original del PDF",
  "Original PDF image is unavailable. Reload to retry importing the local library.":
    "La imagen original del PDF no está disponible. Recarga para reintentar la importación de la biblioteca local.",

  // Session results and rows
  "← Back to practice": "← Volver a la práctica",
  "Calculator workspace": "Calculadora",
  "SESSION REVIEW": "REVISIÓN DE LA SESIÓN",
  "{correct} of {answered} answered correctly.":
    "{correct} de {answered} contestadas correctamente.",
  "A place to pick up again.": "Un punto para retomar.",
  "{percent}% accuracy on answered questions.":
    "{percent}% de aciertos en las preguntas contestadas.",
  "No answers submitted.": "No se envió ninguna respuesta.",
  "{n} questions left unanswered.": "{n} preguntas sin contestar.",
  "Every question answered.": "Todas las preguntas contestadas.",
  "{time} active study time": "{time} de estudio activo",
  "Average {time} / answered question":
    "Promedio de {time} por pregunta contestada",
  "{correct} correct, {incorrect} incorrect, {unanswered} unanswered":
    "{correct} correctas, {incorrect} incorrectas, {unanswered} sin contestar",
  "{n} correct": "{n} correctas",
  "{n} incorrect": "{n} incorrectas",
  "{n} unanswered": "{n} sin contestar",
  "What deserves another attempt?": "¿Qué merece otro intento?",
  "Practice mistakes ({n})": "Practicar los errores ({n})",
  "Practice unanswered ({n})": "Practicar las que quedaron sin contestar ({n})",
  "Practice entire session again": "Practicar toda la sesión otra vez",
  "A new shuffled set; this session’s results stay intact.":
    "Un grupo nuevo en otro orden; los resultados de esta sesión no cambian.",
  Show: "Mostrar",
  "All ({n})": "Todas ({n})",
  "Incorrect ({n})": "Incorrectas ({n})",
  "Unanswered ({n})": "Sin contestar ({n})",
  "Correct ({n})": "Correctas ({n})",
  "No questions match this filter.":
    "Ninguna pregunta coincide con este filtro.",
  Correct: "Correcta",
  Incorrect: "Incorrecta",
  Question: "Pregunta",
  " spent": " dedicados",
  "No rationale available.": "No hay explicación disponible.",
  "No answer submitted. Retry unanswered questions to work through this one without revealing the answer.":
    "No se envió respuesta. Vuelve a practicar las preguntas sin contestar para trabajar esta sin ver la respuesta.",
  "Practice session": "Sesión de práctica",
  "Mixed practice": "Práctica mixta",
  Bookmarks: "Marcadores",
  "{n} question": "{n} pregunta",
  "{n} questions": "{n} preguntas",
  "Open session results": "Abrir los resultados de la sesión",
  "Resume practice": "Retomar la práctica",
  "{correct} of {answered} answered correctly":
    "{correct} de {answered} contestadas correctamente",
  "completed {date}": "terminada el {date}",
  "{n} answered": "{n} contestadas",
  "{n} left": "{n} pendientes",
  "started {date}": "empezada el {date}",
  "Unstar session {label}": "Quitar la estrella a la sesión {label}",
  "Star session {label}": "Marcar con estrella la sesión {label}",
  "Unstar session": "Quitar la estrella",
  "Star session": "Marcar con estrella",
  "Session actions for {label}": "Acciones de la sesión {label}",
  Rename: "Renombrar",
  "Practice again": "Practicar otra vez",
  "Delete session": "Eliminar la sesión",
  "Session name": "Nombre de la sesión",
  Save: "Guardar",
  "Clear the name to use the automatic label.":
    "Borra el nombre para usar la etiqueta automática.",
  "Delete this session?": "¿Eliminar esta sesión?",
  "Delete “{label}”? Its answers will also be removed from your progress, and those questions become unanswered again.":
    "¿Eliminar «{label}»? Sus respuestas también se quitarán de tu progreso y esas preguntas volverán a quedar sin contestar.",
  "Deleting a session also removes its answers":
    "Al eliminar una sesión, también se quitan sus respuestas",
  "Off by default: a deleted session leaves your answers, mistakes and accuracy as they are. On: its answers are removed from your progress, and those questions become unanswered again.":
    "Desactivado por defecto: una sesión eliminada deja tus respuestas, errores y aciertos como están. Activado: sus respuestas se quitan de tu progreso y esas preguntas vuelven a quedar sin contestar.",
  "Delete “{label}”? Your answers and bookmarks will stay in your study history.":
    "¿Eliminar «{label}»? Tus respuestas y marcadores se conservan en tu historial de estudio.",
  "Your sessions": "Tus sesiones",
  Starred: "Con estrella",
  Recent: "Recientes",
  "View all sessions ({n})": "Ver todas las sesiones ({n})",
  "Search sessions": "Buscar sesiones",
  "Search session names…": "Buscar por nombre de sesión…",
  "No session names match that search.":
    "Ningún nombre de sesión coincide con esa búsqueda.",
  "Continue unfinished practice": "Continuar la práctica sin terminar",
  Continue: "Continuar",
  "More unfinished sets ({n})": "Más grupos sin terminar ({n})",

  // Review
  "REFLECT & RETURN": "REFLEXIONA Y VUELVE",
  "What deserves another look?": "¿Qué merece otra mirada?",
  "Return to a mistake, finish what you left, or try a familiar set again.":
    "Vuelve a un error, termina lo que dejaste o prueba otra vez un grupo conocido.",
  "{n} questions with an incorrect latest answer.":
    "{n} preguntas con la última respuesta incorrecta.",
  "No mistakes waiting to revisit.": "No hay errores pendientes de repasar.",
  "Practice mistakes": "Practicar los errores",
  "Left unanswered": "Sin contestar",
  "{n} questions from your previous sets still have no submitted answer.":
    "{n} preguntas de tus sesiones anteriores siguen sin respuesta enviada.",
  "Nothing left unanswered in your sets.":
    "No quedó nada sin contestar en tus sesiones.",
  "Practice unanswered": "Practicar las que quedaron sin contestar",
  "{n} saved questions ready to revisit.":
    "{n} preguntas marcadas listas para repasar.",
  "Save a question with the star or E during practice.":
    "Marca una pregunta con la estrella o con la tecla E durante la práctica.",
  "Practice bookmarks": "Practicar los marcadores",
  "A later answer updates these queues; original session results remain unchanged.":
    "Una respuesta posterior actualiza estas listas; los resultados originales de cada sesión no cambian.",
  "After a practice set, you can revisit its results here.":
    "Después de un grupo de práctica, podrás volver a sus resultados aquí.",
  "{time} active time": "{time} activos",
  "View results & retry →": "Ver los resultados y reintentar →",
  "Resume practice →": "Retomar la práctica →",
  "Show older sessions": "Mostrar sesiones anteriores",

  // Performance
  "{n} attempt": "{n} intento",
  "{n} attempts": "{n} intentos",
  "Twelve grouped marks summarize {attempts}.":
    "Doce marcas agrupadas resumen {attempts}.",
  "{correct} correct and {incorrect} incorrect.":
    "{correct} correctas y {incorrect} incorrectas.",
  "{correct} correct and {incorrect} incorrect across {attempts}; marks are grouped.":
    "{correct} correctas y {incorrect} incorrectas en {attempts}; las marcas están agrupadas.",
  "{correct} correct and {incorrect} incorrect across {attempts}.":
    "{correct} correctas y {incorrect} incorrectas en {attempts}.",
  "{label}: not attempted, 0 attempts": "{label}: sin intentar, 0 intentos",
  "{label}: {accuracy}% accuracy across {attempts}":
    "{label}: {accuracy}% de aciertos en {attempts}",
  "{correct} correct · {incorrect} incorrect":
    "{correct} correctas · {incorrect} incorrectas",
  "Limited data so far.": "Todavía hay pocos datos.",
  "No attempts": "Sin intentos",
  "No skills from this domain are available in the local question library.":
    "No hay destrezas de este dominio en la biblioteca local de preguntas.",
  "Review mistakes in {domain}": "Repasar los errores de {domain}",
  "Review mistakes": "Repasar los errores",
  "Practice {domain}": "Practicar {domain}",
  "Practice this domain": "Practicar este dominio",
  "All {name} practice": "Toda la práctica de {name}",
  "PERFORMANCE SO FAR": "TU DESEMPEÑO HASTA AHORA",
  "Explore your answered work": "Explora lo que has contestado",
  "Performance scope": "Alcance del desempeño",
  "Accuracy is correct submitted attempts divided by all submitted attempts in the selected scope. Unanswered questions are not counted; repeated attempts remain separate.":
    "El porcentaje de aciertos es el número de intentos correctos entre todos los intentos enviados en el alcance elegido. Las preguntas sin contestar no cuentan; los intentos repetidos se cuentan por separado.",
  "This is the share of answers you got right in practice. It is not a PAA score: the real score is converted from the full test.":
    "Es el porcentaje de respuestas que acertaste en la práctica. No es una puntuación de la PAA: la puntuación real se convierte a partir de la prueba completa.",

  // Browse
  "This question belongs to an active practice test and may spoil a future Bluebook test. View it anyway?":
    "Esta pregunta pertenece a una prueba de práctica activa y podría arruinar una prueba futura. ¿Verla de todos modos?",
  "← Back to questions": "← Volver a las preguntas",
  "{n} of {total} matching questions": "{n} de {total} preguntas coincidentes",
  "Browse question {n}": "Explorar la pregunta {n}",
  "Domain unspecified": "Dominio sin especificar",
  "Answer choices": "Opciones de respuesta",
  "Difficulty unspecified": "Dificultad sin especificar",
  "Latest result: correct": "Último resultado: correcta",
  "Latest result: incorrect": "Último resultado: incorrecta",
  "No recorded answer": "Sin respuesta registrada",
  "Source ID: {id}": "ID de origen: {id}",
  "QUESTION LIBRARY": "BANCO DE PREGUNTAS",
  "Browse questions.": "Explora las preguntas.",
  "Search the question bank, inspect individual questions, and save the ones you want to revisit.":
    "Busca en el banco de preguntas, abre cada pregunta y marca las que quieras repasar.",
  "Your question library is empty.": "Tu banco de preguntas está vacío.",
  "Add your own College Board question PDFs; they are prepared on this device and nothing is uploaded.":
    "Agrega tus propios PDF de preguntas; se preparan en este dispositivo y no se envía nada.",
  "Find a question": "Buscar una pregunta",
  "Search questions": "Buscar preguntas",
  "Search questions, skills, or source IDs…":
    "Buscar preguntas, destrezas o ID de origen…",
  "Matching questions": "Preguntas coincidentes",
  "No questions match yet.": "Todavía no hay preguntas que coincidan.",
  "Try broadening your filters.": "Prueba con filtros más amplios.",
  "Show more questions": "Mostrar más preguntas",

  // Settings and data
  "Study preferences": "Preferencias de estudio",
  "Timer on by default": "Cronómetro activado por defecto",
  "New sessions start with the timer visible. Each session remembers its own choice afterward.":
    "Las sesiones nuevas empiezan con el cronómetro visible. Cada sesión recuerda después su propia elección.",
  "Show explanations after correct answers":
    "Mostrar las explicaciones después de las respuestas correctas",
  "When off, correct answers stay concise and the explanation remains available on request. Incorrect answers always show it.":
    "Si está desactivado, las respuestas correctas se muestran brevemente y la explicación sigue disponible si la pides. Las incorrectas siempre la muestran.",
  Appearance: "Apariencia",
  Theme: "Tema",
  "Auto · follow system": "Automático · según el sistema",
  "Light · paper & matcha": "Claro · papel y matcha",
  "Dark · earth & parchment": "Oscuro · tierra y pergamino",
  "Keep original PDF colors": "Conservar los colores originales del PDF",
  "PDF text and diagrams normally adapt to the reading theme. Use original colors when a figure’s colors matter; source files are unchanged.":
    "El texto y los diagramas del PDF normalmente se adaptan al tema de lectura. Usa los colores originales cuando los colores de una figura importen; los archivos de origen no cambian.",
  "Your questions": "Tus preguntas",
  "{n} questions are stored in this browser, with your answers.":
    "{n} preguntas guardadas en este navegador, con tus respuestas.",
  "No questions yet. Add your PDFs below.":
    "Todavía no hay preguntas. Agrega tus PDF abajo.",
  "Nothing is uploaded, and no account is needed.":
    "No se envía nada y no hace falta una cuenta.",
  "Previous study state restored. Saved timers are paused.":
    "Se restauró el estado de estudio anterior. Los cronómetros guardados están en pausa.",
  "Study progress reset. Your question bank is ready to use.":
    "Se reinició el progreso. Tu banco de preguntas está listo para usarse.",
  "Questions removed. Add your PDFs again whenever you like.":
    "Se quitaron las preguntas. Puedes agregar tus PDF otra vez cuando quieras.",
  "Stored on this device": "Guardado en este dispositivo",
  "{questions} questions · {attempts} attempts · {bookmarks} bookmarks":
    "{questions} preguntas · {attempts} intentos · {bookmarks} marcadores",
  "Everything lives in this browser, so clearing its site data for {origin} also removes it. Safari can also clear a site's data after about a week without a visit.":
    "Todo vive en este navegador; si borras los datos del sitio {origin}, también se borra. Safari además puede borrar los datos de un sitio tras una semana sin visitarlo.",
  "Choose the PDFs": "Elegir los PDF",
  "PDF export files": "Archivos PDF de preguntas",
  "Chosen exports": "Archivos elegidos",
  Advanced: "Avanzado",
  "Reviewed exceptions (optional JSON file)":
    "Excepciones revisadas (archivo JSON opcional)",
  "Reviewed exceptions": "Excepciones revisadas",
  "Add questions": "Agregar preguntas",
  Progress: "Progreso",
  "Starting…": "Empezando…",
  "Cancelled. What was already prepared is kept and is reused if you start again.":
    "Cancelado. Lo que ya se había preparado se conserva y se reutiliza si empiezas de nuevo.",
  "Nothing changed.": "No cambió nada.",
  "These PDFs give exactly the {n} questions and images already stored.":
    "Estos PDF dan exactamente las {n} preguntas e imágenes que ya estaban guardadas.",
  "Added {n} questions.": "Se agregaron {n} preguntas.",
  "{n} could not be read safely and were left out.":
    "{n} no se pudieron leer con seguridad y se dejaron fuera.",
  "How this was worked out": "Cómo se hizo",
  "Download report": "Descargar el informe",
  "Set aside, because they are not PAA question exports: {files}":
    "Se dejaron aparte porque no son exportaciones de preguntas de la PAA: {files}",
  "Set aside, because they are not TSI question exports: {files}":
    "Se dejaron aparte porque no son exportaciones de preguntas de la TSI: {files}",
  "{official} College Board sample items and {original} original items.":
    "{official} preguntas de muestra de College Board y {original} preguntas originales.",
  "Noted: {warning}": "Nota: {warning}",
  "Include original questions": "Incluir las preguntas originales",
  "When off, the original questions are hidden everywhere (practice, Browse, Review and your progress) and nothing is deleted. Sessions that contain them stay, without those questions. Turn it on to bring them back.":
    "Si está apagado, las preguntas originales se ocultan en todas partes (práctica, Explorar, Repaso y tu progreso) y no se borra nada. Las sesiones que las contienen se conservan, sin esas preguntas. Enciéndelo para recuperarlas.",
  Official: "Oficial",
  Original: "Original",
  "College Board sample item": "Pregunta de muestra de College Board",
  "Original practice item": "Pregunta de práctica original",
  "Basic calculator": "Calculadora básica",
  "Square root calculator": "Calculadora con raíz cuadrada",
  "Graphing calculator": "Calculadora gráfica",
  "This is the share of answers you got right in practice. It is not a TSI score: the real TSIA2 adapts to each student and College Board publishes no conversion, so this portal shows no score and no pass or fail.":
    "Es la proporción de respuestas correctas en tu práctica. No es una puntuación de la TSI: la TSIA2 real se adapta a cada estudiante y College Board no publica una conversión, así que este portal no muestra puntuación ni aprobado o reprobado.",
  "Finish test": "Terminar la prueba",
  "Review and finish →": "Revisar y terminar →",
  "Reset study progress": "Reiniciar el progreso de estudio",
  "Clear your answers and sessions to start fresh. You can keep your bookmarks. This also restores Practice Test question eligibility.":
    "Borra tus respuestas y sesiones para empezar de cero. Puedes conservar tus marcadores.",
  "One recovery archive · {date}": "Un archivo de recuperación · {date}",
  "Restore previous study state": "Restaurar el estado de estudio anterior",
  "Restore previous study state?": "¿Restaurar el estado de estudio anterior?",
  "Reset study progress?": "¿Reiniciar el progreso de estudio?",
  "This replaces your current answers, sessions, drafts, recorded time, and bookmarks with the state saved immediately before your last reset. Your question bank and preferences stay unchanged. Saved ordinary timers will be paused. Practice Test clocks retain their original start times and exposure history.":
    "Esto reemplaza tus respuestas, sesiones, borradores, tiempo registrado y marcadores actuales por el estado guardado justo antes de tu último reinicio. Tu banco de preguntas y tus preferencias no cambian. Los cronómetros guardados quedarán en pausa.",
  "This clears all answers, completed and unfinished sessions, drafts, and recorded practice time. Your question bank and interface preferences will remain available.":
    "Esto borra todas las respuestas, las sesiones terminadas y sin terminar, los borradores y el tiempo de práctica registrado. Tu banco de preguntas y tus preferencias de la interfaz se conservan.",
  "Your current study state, including all bookmarks, will be saved locally as one recovery archive. This replaces any previous reset archive.":
    "Tu estado de estudio actual, con todos los marcadores, se guardará en este dispositivo como un archivo de recuperación. Este reemplaza cualquier archivo de reinicio anterior.",
  "Also clear bookmarks": "Borrar también los marcadores",
  "Confirm restore": "Confirmar la restauración",
  "Confirm reset": "Confirmar el reinicio",
  "Free up space": "Liberar espacio",
  "This site is using about {size} on this device.":
    "Este sitio usa unos {size} en este dispositivo.",
  "The question images take most of it.":
    "Las imágenes de las preguntas ocupan casi todo.",
  "Remove my questions": "Quitar mis preguntas",
  "Erase all data on this device": "Borrar todos los datos de este dispositivo",
  "Erase all data on this device?":
    "¿Borrar todos los datos de este dispositivo?",
  "Remove your questions?": "¿Quitar tus preguntas?",
  "This deletes your questions, answers, sessions, bookmarks and settings from this browser, and the saved offline copy of the app. It cannot be undone.":
    "Esto borra de este navegador tus preguntas, respuestas, sesiones, marcadores y ajustes, de la SAT y de la PAA, y también la copia guardada de la aplicación para usarla sin conexión. No se puede deshacer.",
  "Your original PDFs are not touched, so you can add them again.":
    "Tus PDF originales no se tocan, así que puedes agregarlos otra vez.",
  "This deletes the questions and their images from this browser and ends your saved sessions. Your answers and bookmarks are kept and apply again when you add the same PDFs.":
    "Esto borra de este navegador las preguntas de la PAA y sus imágenes, y termina tus sesiones guardadas de la PAA. Tus respuestas y marcadores se conservan y vuelven a aplicarse cuando agregues los mismos PDF. La SAT no se toca.",
  "Your original PDFs are not touched.": "Tus PDF originales no se tocan.",
  "Erase everything": "Borrar todo",
  "Remove questions": "Quitar las preguntas",
  "Your question PDFs": "Tus PDF de preguntas",
  "Add PDFs": "Agregar PDF",
  "These are the PDFs your questions came from. Add more, or take one out; your answers and bookmarks are kept.":
    "Estos son los PDF de los que salieron tus preguntas. Agrega más o quita uno; tus respuestas y marcadores se conservan.",
  "No PDFs added yet. Add your question PDFs: they are read in this browser and never uploaded.":
    "Todavía no hay PDF. Agrega tus PDF de preguntas: se leen en este navegador y nunca se envían.",
  "{n} active (hidden until you include them)":
    "{n} activas (ocultas hasta que las incluyas)",
  "{n} inactive": "{n} inactivas",
  "{n} unknown": "{n} desconocidas",
  Remove: "Quitar",
  "Remove {name}": "Quitar {name}",
  "Remove {name}?": "¿Quitar {name}?",
  "Remove PDF": "Quitar el PDF",
  "This deletes the {n} questions that come only from this PDF, and their images, from this browser, and ends saved sessions that use them. Your answers and bookmarks are kept and apply again when you add the PDF again.":
    "Esto borra de este navegador las {n} preguntas que vienen solo de este PDF, con sus imágenes, y termina las sesiones guardadas que las usan. Tus respuestas y marcadores se conservan y vuelven a aplicarse cuando agregues el PDF otra vez.",
  "{n} questions also come from another PDF and stay.":
    "{n} preguntas también vienen de otro PDF y se quedan.",
  "The SAT exports are read together, so to add this one back, add all four again.":
    "Las exportaciones de la SAT se leen juntas; para volver a agregar esta, agrega las cuatro otra vez.",
  "PDF removed. Add it again whenever you like; your answers and bookmarks were kept.":
    "Se quitó el PDF. Puedes agregarlo otra vez cuando quieras; tus respuestas y marcadores se conservaron.",
  Close: "Cerrar",
  "These are {test} questions. Use the switch at the top to open them.":
    "Estas son preguntas de {test}. Usa el interruptor de arriba para abrirlas.",
  "Close window": "Cerrar la ventana",
  "Drop all your PDFs, or the folder that holds them, together: the four SAT exports, your PAA export and your TSI exports. They are sorted for you, read in this browser and never uploaded. The whole set can take 5 to 10 minutes; keep this tab open while it works.":
    "Suelta juntos todos tus PDF, o la carpeta que los contiene: las cuatro exportaciones de la SAT, tu exportación de la PAA y tus exportaciones de la TSI. Se ordenan solos, se leen en este navegador y nunca se envían. Todo el conjunto puede tardar de 5 a 10 minutos; mantén esta pestaña abierta mientras trabaja.",
  "Drop PDFs here": "Suelta los PDF aquí",
  "SAT exports are recognised by name: read_write_active.pdf, read_write_inactive.pdf, math_active.pdf and math_inactive.pdf. Any other PDF is sorted by the test named inside it (PAA or TSIA2), or set aside if it is neither.":
    "Las exportaciones de la SAT se reconocen por el nombre: read_write_active.pdf, read_write_inactive.pdf, math_active.pdf y math_inactive.pdf. Cualquier otro PDF se ordena según la prueba que nombra por dentro (PAA o TSIA2), o se deja aparte si no es ninguna.",
  "Checking…": "Comprobando…",
  "TSI export": "Exportación de la TSI",
  "PAA export": "Exportación de la PAA",
  "Not a PAA or TSI question export: it will be set aside":
    "No es una exportación de preguntas de la PAA ni de la TSI: se dejará aparte",
  "PAA export, or set aside (checked when reading)":
    "Exportación de la PAA, o se deja aparte (se comprueba al leer)",
  Math: "Matemáticas",
  "Reading & Writing": "Lectura y redacción",
  active: "activa",
  inactive: "inactiva",
  "Ignored, because they are not PDFs: {files}":
    "Se ignoraron porque no son PDF: {files}",
  "The SAT exports are read together. Still needed: {files}":
    "Las exportaciones de la SAT se leen juntas. Faltan: {files}",
  "None of these PDFs is a question export, so nothing was added. Set aside: {files}":
    "Ninguno de estos PDF es una exportación de preguntas, así que no se agregó nada. Se dejaron aparte: {files}",
  "{active} are marked active and stay hidden until you choose to include them; {inactive} are inactive.":
    "{active} están marcadas como activas y siguen ocultas hasta que decidas incluirlas; {inactive} son inactivas.",
  "{n} are unknown.": "{n} son desconocidas.",
  "Left out: {id} ({file}, pages {pages}): {reason}":
    "Se dejó fuera: {id} ({file}, páginas {pages}): {reason}",
};
