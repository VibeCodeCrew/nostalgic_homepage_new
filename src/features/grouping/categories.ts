// Встроенный словарь категорий для автогруппировки ярлыков.
// Сопоставление — по доменному суффиксу хоста (см. categorize в ./index.ts).
// Порядок категорий = порядок показа в меню/проводнике.

export interface CategoryDef {
    name: string;      // отображаемое имя группы
    icon: string;      // имя png из icons/ (без размера), 'folder' по умолчанию
    domains: string[]; // доменные суффиксы (host.endsWith)
}

export const CATEGORY_OTHER = 'Прочее';

export const CATEGORIES: CategoryDef[] = [
    {
        name: 'Соцсети', icon: 'network',
        domains: ['vk.com', 'vk.ru', 'vkvideo.ru', 'ok.ru', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'threads.net', 'tiktok.com', 'reddit.com', 'linkedin.com', 'pinterest.com', 'tumblr.com', 'mastodon.social', 'bsky.app'],
    },
    {
        name: 'Мессенджеры', icon: 'internet',
        domains: ['web.telegram.org', 'web.whatsapp.com', 'discord.com', 'discord.gg', 'slack.com', 'signal.org', 'viber.com', 'teams.microsoft.com', 'zoom.us'],
    },
    {
        name: 'Видео', icon: 'my-pictures',
        domains: ['youtube.com', 'youtu.be', 'rutube.ru', 'dzen.ru', 'twitch.tv', 'vimeo.com', 'coub.com', 'vkvideo.ru'],
    },
    {
        name: 'Фильмы и сериалы', icon: 'my-pictures',
        domains: ['kinopoisk.ru', 'ivi.ru', 'okko.tv', 'netflix.com', 'kion.ru', 'start.ru', 'more.tv', 'premier.one', 'wink.ru', 'amediateka.ru', 'hdrezka.ag', 'filmix.ac'],
    },
    {
        name: 'Музыка', icon: 'my-music',
        domains: ['music.yandex.ru', 'music.yandex.com', 'spotify.com', 'soundcloud.com', 'deezer.com', 'music.apple.com', 'zvuk.com', 'last.fm', 'bandcamp.com'],
    },
    {
        name: 'Игры', icon: 'hearts',
        domains: ['steampowered.com', 'store.steampowered.com', 'epicgames.com', 'gog.com', 'itch.io', 'roblox.com', 'minecraft.net', 'chess.com', 'lichess.org', 'crazygames.com', 'poki.com', 'y8.com', 'miniclip.com', 'riotgames.com', 'battle.net', 'origin.com', 'ubisoft.com', 'ea.com'],
    },
    {
        name: 'Покупки', icon: 'favorites',
        domains: ['ozon.ru', 'wildberries.ru', 'market.yandex.ru', 'aliexpress.ru', 'aliexpress.com', 'amazon.com', 'ebay.com', 'avito.ru', 'megamarket.ru', 'sbermegamarket.ru', 'lamoda.ru', 'dns-shop.ru', 'mvideo.ru', 'eldorado.ru', 'citilink.ru', 'sbermarket.ru', 'vseinstrumenti.ru', 'petrovich.ru', 'leroymerlin.ru'],
    },
    {
        name: 'Финансы', icon: 'calculator',
        domains: ['online.sberbank.ru', 'sberbank.ru', 'tbank.ru', 'tinkoff.ru', 'alfabank.ru', 'vtb.ru', 'raiffeisen.ru', 'gazprombank.ru', 'paypal.com', 'wise.com', 'investing.com', 'binance.com', 'coinbase.com', 'moex.com', 'finam.ru'],
    },
    {
        name: 'Новости', icon: 'document',
        domains: ['ria.ru', 'tass.ru', 'lenta.ru', 'rbc.ru', 'gazeta.ru', 'kommersant.ru', 'meduza.io', 'novayagazeta.ru', 'bbc.com', 'cnn.com', 'news.yandex.ru', 'news.google.com', 'habr.com', 'vc.ru', 'dtf.ru', 'theguardian.com', 'nytimes.com', 'reuters.com'],
    },
    {
        name: 'Почта', icon: 'document',
        domains: ['mail.ru', 'e.mail.ru', 'gmail.com', 'mail.google.com', 'mail.yandex.ru', 'outlook.com', 'outlook.live.com', 'proton.me', 'protonmail.com', 'yahoo.com'],
    },
    {
        name: 'Работа и документы', icon: 'my-documents',
        domains: ['docs.google.com', 'drive.google.com', 'notion.so', 'trello.com', 'atlassian.net', 'jira.com', 'asana.com', 'monday.com', 'hh.ru', 'office.com', 'office365.com', 'sharepoint.com', 'airtable.com', 'miro.com', 'clickup.com', 'basecamp.com'],
    },
    {
        name: 'Разработка', icon: 'cmd',
        domains: ['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com', 'codepen.io', 'codesandbox.io', 'vercel.com', 'netlify.com', 'npmjs.com', 'pypi.org', 'docker.com', 'kubernetes.io', 'learn.javascript.ru', 'developer.mozilla.org', 'chatgpt.com', 'chat.openai.com', 'claude.ai', 'kimi.com', 'gemini.google.com', 'copilot.microsoft.com'],
    },
    {
        name: 'Образование', icon: 'help',
        domains: ['coursera.org', 'stepik.org', 'udemy.com', 'skillbox.ru', 'geekbrains.ru', 'netology.ru', 'wikipedia.org', 'wikimedia.org', 'khanacademy.org', 'duolingo.com', 'openedu.ru', 'foxford.ru'],
    },
    {
        name: 'Карты и транспорт', icon: 'network',
        domains: ['maps.yandex.ru', 'yandex.ru/maps', 'maps.google.com', '2gis.ru', 'taxi.yandex.ru', 't.yandex.ru', 'go.yandex', 'uber.com', 'rzd.ru', 'aeroexpress.ru', 'waze.com'],
    },
    {
        name: 'Еда и доставка', icon: 'favorites',
        domains: ['eda.yandex.ru', 'eda.yandex', 'market-delivery.yandex.ru', 'samokat.ru', 'dominos.ru', 'dodopizza.ru', 'kfc.ru', 'burgerking.ru', 'mcdonalds.ru', 'vkusvill.ru', 'lavka.yandex.ru'],
    },
    {
        name: 'Путешествия', icon: 'internet',
        domains: ['booking.com', 'airbnb.com', 'aviasales.ru', 'skyscanner.com', 'ostrovok.ru', 'onetwotrip.com', 'sletat.ru', 'tutu.ru', 'tripadvisor.com'],
    },
    {
        name: 'Облака и файлы', icon: 'folder',
        domains: ['disk.yandex.ru', 'disk.yandex.com', 'dropbox.com', 'onedrive.live.com', 'onedrive.com', 'mega.nz', 'mega.io', 'box.com', 'icloud.com', 'wetransfer.com'],
    },
    {
        name: 'Фото и дизайн', icon: 'my-pictures',
        domains: ['figma.com', 'canva.com', 'behance.net', 'dribbble.com', 'unsplash.com', 'pexels.com', 'photopea.com', 'pixabay.com', 'deviantart.com', 'adobe.com'],
    },
    {
        name: 'Госуслуги', icon: 'my-computer',
        domains: ['gosuslugi.ru', 'nalog.ru', 'nalog.gov.ru', 'pfr.gov.ru', 'sfr.gov.ru', 'mos.ru', 'fssprus.ru', 'kad.arbitr.ru'],
    },
    {
        name: 'Недвижимость', icon: 'desktop',
        domains: ['cian.ru', 'domclick.ru', 'realty.yandex.ru', 'avito.ru/nedvizhimost', 'move.ru', 'yandex.ru/realty'],
    },
    {
        name: 'Авто', icon: 'my-computer',
        domains: ['auto.ru', 'drom.ru', 'drive2.ru', 'avtodispetcher.ru', 'gibdd.ru', 'avtonomer.net'],
    },
    {
        name: 'Спорт', icon: 'play',
        domains: ['sports.ru', 'championat.com', 'sport-express.ru', 'strava.com', 'eurosport.com', 'espn.com', 'fifa.com', 'uefa.com', 'matchtv.ru'],
    },
    {
        name: 'Книги', icon: 'document',
        domains: ['litres.ru', 'flibusta.is', 'audible.com', 'bookmate.com', 'mybook.ru', 'amazon.com/kindle', 'goodreads.com', 'author.today'],
    },
    {
        name: 'Погода', icon: 'search',
        domains: ['gismeteo.ru', 'weather.com', 'yandex.ru/pogoda', 'pogoda.yandex.ru', 'rp5.ru', 'accuweather.com', 'windy.com'],
    },
    {
        name: 'Поиск', icon: 'search',
        domains: ['yandex.ru', 'ya.ru', 'yandex.com', 'google.com', 'duckduckgo.com', 'bing.com', 'startpage.com', 'qwant.com'],
    },
];
