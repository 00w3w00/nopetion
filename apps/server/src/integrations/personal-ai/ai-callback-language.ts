import { aiLocale } from './ai-languages';

const messages: Record<
  string,
  readonly [string, string, string, string, string]
> = {
  'en-US': [
    'Nopetion AI connection',
    'ChatGPT connected. Return to AI settings in your original Nopetion tab to check the connection and choose a model.',
    'Close this tab and return to the original tab.',
    'ChatGPT connection failed. Return to AI settings and sign in again. If this continues, check the dedicated AI volume and file permissions.',
    'ChatGPT sign-in was canceled. Your existing connection is preserved.',
  ],
  'ko-KR': [
    'Nopetion AI 연결',
    'ChatGPT 연결을 완료했습니다. 원래 Nopetion 탭의 AI 설정에서 연결을 확인하고 모델을 선택해 주세요.',
    '이 탭을 닫고 원래 탭으로 돌아가세요.',
    'ChatGPT 연결에 실패했습니다. AI 설정에서 다시 로그인해 주세요. 계속 실패하면 전용 AI 볼륨과 파일 권한을 확인해 주세요.',
    'ChatGPT 로그인이 취소되었습니다. 기존 연결은 보존됩니다.',
  ],
  'ja-JP': [
    'Nopetion AI 接続',
    'ChatGPTに接続しました。元のNopetionタブのAI設定で接続を確認し、モデルを選択してください。',
    'このタブを閉じて元のタブに戻ってください。',
    'ChatGPTへの接続に失敗しました。AI設定から再度ログインしてください。問題が続く場合はAI専用ボリュームとファイル権限を確認してください。',
    'ChatGPTへのログインはキャンセルされました。既存の接続は保持されます。',
  ],
  'zh-CN': [
    'Nopetion AI 连接',
    'ChatGPT已连接。请返回原Nopetion标签页的AI设置，检查连接并选择模型。',
    '请关闭此标签页并返回原标签页。',
    'ChatGPT连接失败。请在AI设置中重新登录。如果问题持续，请检查AI专用卷和文件权限。',
    'ChatGPT登录已取消。现有连接已保留。',
  ],
  'de-DE': [
    'Nopetion KI-Verbindung',
    'ChatGPT verbunden. Prüfe die Verbindung in den KI-Einstellungen des ursprünglichen Nopetion-Tabs und wähle ein Modell.',
    'Schließe diesen Tab und kehre zum ursprünglichen Tab zurück.',
    'ChatGPT-Verbindung fehlgeschlagen. Melde dich in den KI-Einstellungen erneut an. Prüfe bei weiteren Fehlern das separate KI-Volume und die Dateiberechtigungen.',
    'Die ChatGPT-Anmeldung wurde abgebrochen. Die bestehende Verbindung bleibt erhalten.',
  ],
  'es-ES': [
    'Conexión de IA de Nopetion',
    'ChatGPT conectado. Vuelve a los ajustes de IA de la pestaña original de Nopetion para comprobar la conexión y elegir un modelo.',
    'Cierra esta pestaña y vuelve a la original.',
    'La conexión de ChatGPT ha fallado. Inicia sesión de nuevo en los ajustes de IA. Si continúa, comprueba el volumen de IA y los permisos de los archivos.',
    'Se ha cancelado el inicio de sesión de ChatGPT. Se conserva la conexión existente.',
  ],
  'fr-FR': [
    'Connexion IA Nopetion',
    'ChatGPT connecté. Retournez dans les paramètres IA de votre onglet Nopetion d’origine pour vérifier la connexion et choisir un modèle.',
    'Fermez cet onglet et revenez à l’onglet d’origine.',
    'Échec de la connexion ChatGPT. Reconnectez-vous dans les paramètres IA. Si le problème persiste, vérifiez le volume IA dédié et les permissions des fichiers.',
    'La connexion ChatGPT a été annulée. La connexion existante est conservée.',
  ],
  'nl-NL': [
    'Nopetion AI-verbinding',
    'ChatGPT verbonden. Ga terug naar de AI-instellingen in je oorspronkelijke Nopetion-tab om de verbinding te controleren en een model te kiezen.',
    'Sluit deze tab en ga terug naar de oorspronkelijke tab.',
    'ChatGPT-verbinding mislukt. Log opnieuw in via de AI-instellingen. Controleer bij aanhoudende fouten het aparte AI-volume en de bestandsrechten.',
    'Inloggen bij ChatGPT is geannuleerd. De bestaande verbinding blijft behouden.',
  ],
  'pt-BR': [
    'Conexão de IA do Nopetion',
    'ChatGPT conectado. Volte às configurações de IA na aba original do Nopetion para verificar a conexão e escolher um modelo.',
    'Feche esta aba e volte à aba original.',
    'Falha na conexão do ChatGPT. Faça login novamente nas configurações de IA. Se continuar, verifique o volume dedicado de IA e as permissões dos arquivos.',
    'O login do ChatGPT foi cancelado. A conexão existente foi preservada.',
  ],
  'it-IT': [
    'Connessione IA Nopetion',
    'ChatGPT collegato. Torna alle impostazioni IA nella scheda Nopetion originale per verificare la connessione e scegliere un modello.',
    'Chiudi questa scheda e torna a quella originale.',
    'Connessione ChatGPT non riuscita. Accedi di nuovo nelle impostazioni IA. Se il problema persiste, controlla il volume IA dedicato e i permessi dei file.',
    'L’accesso a ChatGPT è stato annullato. La connessione esistente è conservata.',
  ],
  'uk-UA': [
    'Підключення ШІ Nopetion',
    'ChatGPT підключено. Поверніться до налаштувань ШІ в початковій вкладці Nopetion, перевірте підключення та виберіть модель.',
    'Закрийте цю вкладку й поверніться до початкової.',
    'Не вдалося підключити ChatGPT. Увійдіть знову в налаштуваннях ШІ. Якщо помилка повторюється, перевірте окремий том ШІ та дозволи файлів.',
    'Вхід у ChatGPT скасовано. Наявне підключення збережено.',
  ],
  'ru-RU': [
    'Подключение ИИ Nopetion',
    'ChatGPT подключён. Вернитесь к настройкам ИИ в исходной вкладке Nopetion, проверьте подключение и выберите модель.',
    'Закройте эту вкладку и вернитесь к исходной.',
    'Не удалось подключить ChatGPT. Войдите снова в настройках ИИ. Если ошибка повторяется, проверьте отдельный том ИИ и права файлов.',
    'Вход в ChatGPT отменён. Существующее подключение сохранено.',
  ],
};
export function aiCallbackMessages(locale?: string) {
  const language = aiLocale(locale);
  const [title, connected, close, error, canceled] = messages[language];
  return { language, title, connected, close, error, canceled };
}
