export type Lang = "ru" | "kg";

type Dict = Record<string, string>;

const ru: Dict = {
  "nav.home": "Главная",
  "nav.tests": "Анализы",
  "nav.meds": "Лекарства",
  "nav.profile": "Профиль",
  "profile.title": "Профиль",
  "profile.subtitle": "Язык и настройки.",
  "profile.language": "Язык интерфейса",
  "profile.languageHint": "Статусы, заголовки и подсказки будут на выбранном языке.",
  "analyses.title": "Анализы (активный профиль)",
  "analyses.subtitle":
    "Загрузите новый анализ кнопкой «Загрузить анализ». Цвета — относительно нормы.",
  "analyses.loading": "Загрузка…",
  "analyses.empty": "Для этого профиля анализов нет.",
  "analyses.errorLoad": "Ошибка загрузки",
  "analyses.indicators": "показателей",
  "analyses.analysis": "Анализ",
  "analyses.private": "личное",
  "analyses.shareDoctor": "Показать врачу",
  "analyses.qrTitle": "QR (15 мин)",
  "analyses.qrHint": "Врач открывает ссылку или сканирует QR.",
  "analyses.dynamics": "Динамика (2+ анализа)",
  "analyses.aiInsight": "Подсказка:",
  "analyses.disclaimer":
    "Информация справочная, не диагноз. Решение о лечении принимает врач.",
  "analyses.nearLabs": "Ближайшие лаборатории",
  "analyses.nearLabsHint": "При отклонениях от нормы имеет смысл пересдать анализы.",
  "analyses.findClinic": "Записаться в клинику",
  "status.normal": "норма",
  "status.warning": "внимание",
  "status.critical": "критично",
  "paywall.title": "Premium",
  "paywall.body":
    "Бесплатно: 3 анализа и 1 профиль. Premium: безлимит и семейный доступ.",
  "paywall.close": "Закрыть",
  "paywall.mbank": "MBANK аркылуу төлөө",
  "paywall.paying": "Оплата…",
  "paywall.success": "Premium активдештирилди!",
  "paywall.megapay": "MegaPay (скоро)",
  "dashboard.tagline": "Emerald Kyrgyzstan",
  "dashboard.title": "Главная",
  "dashboard.subtitle": "Анализы и члены семьи для активного профиля.",
  "dashboard.hello": "Здравствуйте",
  "dashboard.authRequired": "Требуется вход. Откройте приложение через Telegram.",
  "dashboard.authTitle": "Вход через Telegram Mini App",
  "dashboard.authBody":
    "Откройте приложение внутри Telegram. На сервере должен быть TELEGRAM_BOT_TOKEN.",
  "dashboard.devHint":
    "Dev: ALLOW_DEV_LOGIN и NEXT_PUBLIC_ALLOW_DEV_LOGIN — тест из браузера.",
  "dashboard.errorPrefix": "Ошибка:",
  "dashboard.premiumCta": "Premium: безлимит анализов и профилей семьи",
  "dashboard.upload": "Загрузить анализ",
  "dashboard.brandSample": "Цвет темы из конфига (#00695C).",
  "share.title": "Анализ для врача",
  "share.profile": "Пациент",
  "share.openOriginal": "Оригинал документа",
  "share.biomarkers": "Показатели",
  "share.expires": "Ссылка действует 15 минут.",
  "share.home": "На главную",
  "tests.title": "Тесты",
  "tests.subtitle": "Страница в разработке.",
  "footer.disclaimer":
    "Сервис справочный. Не диагноз. Обратитесь к врачу.",
};

const kg: Dict = {
  "nav.home": "Башкы",
  "nav.tests": "Тесттер",
  "nav.meds": "Дары",
  "nav.profile": "Профиль",
  "profile.title": "Профиль",
  "profile.subtitle": "Тил жана жөндөөлөр.",
  "profile.language": "Тил",
  "profile.languageHint": "Системалык билдирүүлөрдүн тили.",
  "analyses.title": "Анализдер (активдүү профиль)",
  "analyses.subtitle":
    "Жаңы жүктөө үчүн «Анализ жүктөө» баскычын басыңыз. Түстөр — нормага карата.",
  "analyses.loading": "Жүктөлүүдө…",
  "analyses.empty": "Бул профиль үчүн анализ жок.",
  "analyses.errorLoad": "Жүктөө катасы",
  "analyses.indicators": "көрсөткүч",
  "analyses.analysis": "Анализ",
  "analyses.private": "жеке",
  "analyses.shareDoctor": "Врачка көрсөтүү",
  "analyses.qrTitle": "QR (15 мүн)",
  "analyses.qrHint": "Врач шилтемени же QR менен ачат.",
  "analyses.dynamics": "Динамика (2+ анализ)",
  "analyses.aiInsight": "Кеңеш:",
  "analyses.disclaimer":
    "Маалыматтар билим берүүчү гана. Диагноз эмес. Дарыер чечим кабыл алат.",
  "analyses.nearLabs": "Жакын арадагы лабораториялар",
  "analyses.nearLabsHint": "Көрсөткүчтөр калыптан чыкканда кайра текшерүү сунушталат.",
  "analyses.findClinic": "Клиника табуу",
  "status.normal": "норма",
  "status.warning": "эскертүү",
  "status.critical": "критикалык",
  "paywall.title": "Premium",
  "paywall.body":
    "Акысыз: 3 анализ жана 1 профиль. Premium: чексиз + үй-бүлөгө кирүү.",
  "paywall.close": "Жабуу",
  "paywall.mbank": "MBANK аркылуу төлөө",
  "paywall.paying": "Төлөм…",
  "paywall.success": "Premium активдештирилди!",
  "paywall.megapay": "MegaPay (кийинчерээк)",
  "dashboard.tagline": "Emerald Kyrgyzstan",
  "dashboard.title": "Башкы бет",
  "dashboard.subtitle": "Активдүү профиль боюнча анализдер жана үй-бүлө мүчөлөрү.",
  "dashboard.hello": "Салам",
  "dashboard.authRequired": "Кирүү керек. Telegram аркылуу ачыңыз.",
  "dashboard.authTitle": "Кирүү: Telegram Mini App",
  "dashboard.authBody":
    "Колдонмону Telegram ичинен ачыңыз. Серверде TELEGRAM_BOT_TOKEN коюлган болушу керек.",
  "dashboard.devHint":
    "Dev: ALLOW_DEV_LOGIN жана NEXT_PUBLIC_ALLOW_DEV_LOGIN — браузерден сынак.",
  "dashboard.errorPrefix": "Ката:",
  "dashboard.premiumCta": "Premium: чексиз анализ жана үй-бүлө профилдери",
  "dashboard.upload": "Анализ жүктөө",
  "dashboard.brandSample": "Тема түсү (#00695C).",
  "share.title": "Анализ (врач үчүн)",
  "share.profile": "Пациент",
  "share.openOriginal": "Документ (оригинал)",
  "share.biomarkers": "Көрсөткүчтөр",
  "share.expires": "Шилтеме 15 мүн иштейт.",
  "share.home": "Башкы бетке",
  "tests.title": "Тесттер",
  "tests.subtitle": "Баракча даярдалууда.",
  "footer.disclaimer":
    "Бул маалыматтык кызмат. Диагноз эмес. Дарыгерге кайрылыңыз",
};

const dicts: Record<Lang, Dict> = { ru, kg };

export function t(lang: Lang, key: string): string {
  const table = dicts[lang] ?? dicts.ru;
  return table[key] ?? dicts.ru[key] ?? key;
}
