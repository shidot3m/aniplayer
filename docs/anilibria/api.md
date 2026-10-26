# Документация AniLiberty API V1

> **Официальный источник:** [https://aniliberty.top/api/docs/v1](https://aniliberty.top/api/docs/v1)
> **Версия спецификации:** 1.0.0
> **OpenAPI:** 3.0.0

Данный документ содержит полное описание методов, параметров, структур запросов и ответов REST API AniLiberty V1.

---

## Базовые URL и окружение

| Сервер         | Базовый URL                     | Описание       |
| :------------- | :------------------------------ | :------------- |
| This server    | `/api/v1`                       | This server    |
| Main server #1 | `https://aniliberty.top/api/v1` | Main server #1 |

Основной публичный базовый URL: `https://aniliberty.top/api/v1`

## Авторизация

Для запросов, требующих авторизации, используется HTTP-схема **Bearer Token** (`sessionToken`).

Токен сессии передается в заголовке `Authorization`:
```http
Authorization: Bearer <sessionToken>
```

Токен можно получить через методы:
- `/accounts/users/auth/login` (вход по логину/email и паролю)
- `/accounts/otp/login` (вход через одноразовый пароль OTP)
- `/accounts/users/auth/social/authenticate` (вход через социальные сети)

---

## Содержание

- [Аккаунты.ОдноразовыеПароли](#аккаунтыодноразовыепароли) (3)
  - [`POST` `/accounts/otp/get` — Запрашивает OTP](#post-accountsotpget)
  - [`POST` `/accounts/otp/accept` — Присоединяем пользователя к выданному OTP](#post-accountsotpaccept)
  - [`POST` `/accounts/otp/login` — Авторизуемся по OTP](#post-accountsotplogin)
- [Аккаунты.Пользователи.Авторизация](#аккаунтыпользователиавторизация) (2)
  - [`POST` `/accounts/users/auth/login` — Авторизация пользователя](#post-accountsusersauthlogin)
  - [`POST` `/accounts/users/auth/logout` — Деавторизация пользователя](#post-accountsusersauthlogout)
- [Аккаунты.Пользователи.Авторизация.СоциальныеСети](#аккаунтыпользователиавторизациясоциальныесети) (2)
  - [`GET` `/accounts/users/auth/social/{provider}/login` — Авторизация пользователя через социальные сети](#get-accountsusersauthsocialproviderlogin)
  - [`GET` `/accounts/users/auth/social/authenticate` — Аутентифицировать пользователя через социальные сети](#get-accountsusersauthsocialauthenticate)
- [Аккаунты.Пользователи.Авторизация.Пароль](#аккаунтыпользователиавторизацияпароль) (2)
  - [`POST` `/accounts/users/auth/password/forget` — Восстановление пароля](#post-accountsusersauthpasswordforget)
  - [`POST` `/accounts/users/auth/password/reset` — Сброс и установка нового пароля](#post-accountsusersauthpasswordreset)
- [Аккаунты.Пользователи.Мое.Коллекции.Справочники](#аккаунтыпользователимоеколлекциисправочники) (4)
  - [`GET` `/accounts/users/me/collections/references/age-ratings` — Список возрастных рейтингов в коллекциях пользователя](#get-accountsusersmecollectionsreferencesage-ratings)
  - [`GET` `/accounts/users/me/collections/references/genres` — Список жанров в коллекциях пользователя](#get-accountsusersmecollectionsreferencesgenres)
  - [`GET` `/accounts/users/me/collections/references/types` — Список типов в коллекциях пользователя](#get-accountsusersmecollectionsreferencestypes)
  - [`GET` `/accounts/users/me/collections/references/years` — Список годов в коллекциях пользователя](#get-accountsusersmecollectionsreferencesyears)
- [Аккаунты.Пользователи.Мое.Коллекции](#аккаунтыпользователимоеколлекции) (5)
  - [`GET` `/accounts/users/me/collections/ids` — Список идентификаторов релизов добавленных в коллекции](#get-accountsusersmecollectionsids)
  - [`GET` `/accounts/users/me/collections/releases` — Список релизов добавленных в коллекцию [GET]](#get-accountsusersmecollectionsreleases)
  - [`POST` `/accounts/users/me/collections/releases` — Список релизов добавленных в коллекцию [POST]](#post-accountsusersmecollectionsreleases)
  - [`POST` `/accounts/users/me/collections` — Добавить релизы в коллекции](#post-accountsusersmecollections)
  - [`DELETE` `/accounts/users/me/collections` — Удалить релизы из коллекций](#delete-accountsusersmecollections)
- [Аккаунты.Пользователи.Мое.Избранное.Справочники](#аккаунтыпользователимоеизбранноесправочники) (5)
  - [`GET` `/accounts/users/me/favorites/references/age-ratings` — Список возрастных рейтингов в избранном пользователя](#get-accountsusersmefavoritesreferencesage-ratings)
  - [`GET` `/accounts/users/me/favorites/references/genres` — Список жанров в избранном пользователя](#get-accountsusersmefavoritesreferencesgenres)
  - [`GET` `/accounts/users/me/favorites/references/sorting` — Список опций сортировки в избранном пользователя](#get-accountsusersmefavoritesreferencessorting)
  - [`GET` `/accounts/users/me/favorites/references/types` — Список типов релизов в избранном пользователя](#get-accountsusersmefavoritesreferencestypes)
  - [`GET` `/accounts/users/me/favorites/references/years` — Список годов выхода релизов в избранном пользователя](#get-accountsusersmefavoritesreferencesyears)
- [Аккаунты.Пользователи.Мое.Избранное](#аккаунтыпользователимоеизбранное) (5)
  - [`GET` `/accounts/users/me/favorites/ids` — Список идентификаторов релизов добавленных в избранное](#get-accountsusersmefavoritesids)
  - [`GET` `/accounts/users/me/favorites/releases` — Список релизов в избранном пользователя](#get-accountsusersmefavoritesreleases)
  - [`POST` `/accounts/users/me/favorites/releases` — Список релизов в избранном пользователя](#post-accountsusersmefavoritesreleases)
  - [`POST` `/accounts/users/me/favorites` — Добавить релизы в избранное](#post-accountsusersmefavorites)
  - [`DELETE` `/accounts/users/me/favorites` — Удалить релизы из избранного](#delete-accountsusersmefavorites)
- [Аккаунты.Пользователи.Мое.Профиль](#аккаунтыпользователимоепрофиль) (1)
  - [`GET` `/accounts/users/me/profile` — Профиль авторизованного пользователя](#get-accountsusersmeprofile)
- [Аккаунты.Пользователи.Мое.Просмотры](#аккаунтыпользователимоепросмотры) (4)
  - [`GET` `/accounts/users/me/views/history` — История просмотренных эпизодов](#get-accountsusersmeviewshistory)
  - [`GET` `/accounts/users/me/views/timecodes` — Таймкоды просмотренных эпизодов](#get-accountsusersmeviewstimecodes)
  - [`POST` `/accounts/users/me/views/timecodes` — Обновление таймкодов прогресса просмотренного эпизода](#post-accountsusersmeviewstimecodes)
  - [`DELETE` `/accounts/users/me/views/timecodes` — Удаление таймкодов просмотра эпизодов](#delete-accountsusersmeviewstimecodes)
- [Реклама.Vasts](#рекламаvasts) (2)
  - [`GET` `/media/vasts` — Список возможных VAST реклам](#get-mediavasts)
  - [`GET` `/media/manifest.xml` — VAST XML с цепочкой реклам](#get-mediamanifestxml)
- [Аниме.Каталог](#анимекаталог) (2)
  - [`GET` `/anime/catalog/releases` — Список релизов в каталоге](#get-animecatalogreleases)
  - [`POST` `/anime/catalog/releases` — Список релизов в каталоге](#post-animecatalogreleases)
- [Аниме.Каталог.Справочники](#анимекаталогсправочники) (8)
  - [`GET` `/anime/catalog/references/age-ratings` — Список возрастных рейтингов в каталоге](#get-animecatalogreferencesage-ratings)
  - [`GET` `/anime/catalog/references/genres` — Список жанров в каталоге](#get-animecatalogreferencesgenres)
  - [`GET` `/anime/catalog/references/production-statuses` — Список возможных статусов озвучки релиза в каталоге](#get-animecatalogreferencesproduction-statuses)
  - [`GET` `/anime/catalog/references/publish-statuses` — Список возможных статусов выхода релиза в каталоге](#get-animecatalogreferencespublish-statuses)
  - [`GET` `/anime/catalog/references/seasons` — Список сезонов релиза в каталоге](#get-animecatalogreferencesseasons)
  - [`GET` `/anime/catalog/references/sorting` — Список возможных типов сортировок в каталоге](#get-animecatalogreferencessorting)
  - [`GET` `/anime/catalog/references/types` — Список типов релизов в каталоге](#get-animecatalogreferencestypes)
  - [`GET` `/anime/catalog/references/years` — Список годов в каталоге](#get-animecatalogreferencesyears)
- [Аниме.Франшизы](#анимефраншизы) (4)
  - [`GET` `/anime/franchises` — Получить список франшиз](#get-animefranchises)
  - [`GET` `/anime/franchises/{franchiseId}` — Получить франшизу](#get-animefranchisesfranchiseid)
  - [`GET` `/anime/franchises/random` — Получить список случайных франшиз](#get-animefranchisesrandom)
  - [`GET` `/anime/franchises/release/{releaseId}` — Получить список франшиз для релиза](#get-animefranchisesreleasereleaseid)
- [Аниме.Жанры](#анимежанры) (4)
  - [`GET` `/anime/genres` — Список всех жанров](#get-animegenres)
  - [`GET` `/anime/genres/{genreId}` — Данные по жанру](#get-animegenresgenreid)
  - [`GET` `/anime/genres/random` — Список случайных жанров](#get-animegenresrandom)
  - [`GET` `/anime/genres/{genreId}/releases` — Список релизов жанра](#get-animegenresgenreidreleases)
- [Аниме.Релизы](#анимерелизы) (7)
  - [`GET` `/anime/releases/latest` — Последние релизы](#get-animereleaseslatest)
  - [`GET` `/anime/releases/random` — Данные по случайным релизам](#get-animereleasesrandom)
  - [`GET` `/anime/releases/recommended` — Данные по рекомендованным релизам](#get-animereleasesrecommended)
  - [`GET` `/anime/releases/list` — Данные по списку релизов](#get-animereleaseslist)
  - [`GET` `/anime/releases/{idOrAlias}` — Данные по релизу](#get-animereleasesidoralias)
  - [`GET` `/anime/releases/{idOrAlias}/members` — Список участников, которые работали над релизом](#get-animereleasesidoraliasmembers)
  - [`GET` `/anime/releases/{idOrAlias}/episodes/timecodes` — Данные по таймкодам просмотра эпизодов релиза](#get-animereleasesidoraliasepisodestimecodes)
- [Аниме.Релизы.Эпизоды](#анимерелизыэпизоды) (2)
  - [`GET` `/anime/releases/episodes/{releaseEpisodeId}` — Данные по эпизоду](#get-animereleasesepisodesreleaseepisodeid)
  - [`GET` `/anime/releases/episodes/{releaseEpisodeId}/timecode` — Данные по просмотру эпизода](#get-animereleasesepisodesreleaseepisodeidtimecode)
- [Аниме.Релизы.РасписаниеРелизов](#анимерелизырасписаниерелизов) (2)
  - [`GET` `/anime/schedule/now` — Данные по расписанию релизов на текущую дату](#get-animeschedulenow)
  - [`GET` `/anime/schedule/week` — Данные по расписанию релизов на текущую неделю](#get-animescheduleweek)
- [Аниме.Торренты](#аниметорренты) (6)
  - [`GET` `/anime/torrents` — Данные по торрентам](#get-animetorrents)
  - [`GET` `/anime/torrents/{hashOrId}` — Данные по торренту](#get-animetorrentshashorid)
  - [`GET` `/anime/torrents/{hashOrId}/file` — Торрент-файл по его hash или id](#get-animetorrentshashoridfile)
  - [`GET` `/anime/torrents/release/{releaseId}` — Данные по торрентам для релиза](#get-animetorrentsreleasereleaseid)
  - [`GET` `/anime/torrents/rss` — RSS лента последних торрентов](#get-animetorrentsrss)
  - [`GET` `/anime/torrents/rss/release/{releaseId}` — RSS лента торрентов релиза](#get-animetorrentsrssreleasereleaseid)
- [Приложение.Поиск](#приложениепоиск) (1)
  - [`GET` `/app/search/releases` — Поиск релизов](#get-appsearchreleases)
- [Приложение.Статус](#приложениестатус) (1)
  - [`GET` `/app/status` — Статус API](#get-appstatus)
- [Медиа.Промо](#медиапромо) (1)
  - [`GET` `/media/promotions` — Список промо-материалов](#get-mediapromotions)
- [Медиа.Видеоконтент](#медиавидеоконтент) (1)
  - [`GET` `/media/videos` — Список видео-роликов](#get-mediavideos)
- [Команды](#команды) (3)
  - [`GET` `/teams/` — Список команд АниЛибрии](#get-teams)
  - [`GET` `/teams/roles` — Список ролей](#get-teamsroles)
  - [`GET` `/teams/users` — Список анилибрийцов](#get-teamsusers)
- [Модели данных (Схемы)](#модели-данных-схемы)

---

## Справочник эндпоинтов

### Аккаунты.ОдноразовыеПароли

#### `POST` /accounts/otp/get

**Запрашивает OTP**

Запрашиваем новый одноразовый пароль

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `53594955e6c7f55f3787b13c20118a94`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле        | Тип      | Обязательное | Описание | Пример                                   |
| :---------- | :------- | :----------- | :------- | :--------------------------------------- |
| `device_id` | `string` | **Да**       | -        | `"n702175b-fa52-5251-a39z-d1f4af0w1cak"` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "device_id": "n702175b-fa52-5251-a39z-d1f4af0w1cak"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                               |
| :------ | :---------------------------------- | :--------------------------------------------------------- |
| **200** | Данные OTP                          | `application/json` (responses.api.v1.accounts.otp.get)     |
| **404** | Не удалось создать OTP              | Нет данных                                                 |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле             | Тип                  | Обязательное | Описание           | Пример                                   |
| :--------------- | :------------------- | :----------- | :----------------- | :--------------------------------------- |
| `otp`            | `object`             | Нет          | Данные по OTP коду | -                                        |
| `otp.code`       | `string`             | Нет          | -                  | `"058701"`                               |
| `otp.user_id`    | `integer`            | Нет          | -                  | `1337`                                   |
| `otp.device_id`  | `string`             | Нет          | -                  | `"n702175b-fa52-5251-a39z-d1f4af0w1cak"` |
| `otp.expired_at` | `string (date-time)` | Нет          | Срок действия кода | `"2021-09-28T19:40:26+00:00"`            |
| `remaining_time` | `integer`            | Нет          | -                  | `120`                                    |

```json
{
  "otp": {
    "code": "058701",
    "user_id": 1337,
    "device_id": "n702175b-fa52-5251-a39z-d1f4af0w1cak",
    "expired_at": "2021-09-28T19:40:26+00:00"
  },
  "remaining_time": 120
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `POST` /accounts/otp/accept

**Присоединяем пользователя к выданному OTP**

Присоединяем пользователя к выданному одноразовому паролю

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `7fad0328b8acfe70c095adefd72c4612`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле   | Тип       | Обязательное | Описание | Пример  |
| :----- | :-------- | :----------- | :------- | :------ |
| `code` | `integer` | **Да**       | -        | `54233` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "code": 54233
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                             | Схема ответа                                               |
| :------ | :----------------------------------- | :--------------------------------------------------------- |
| **200** | Успешная привязка пользователя к OTP | Нет данных                                                 |
| **401** | Пользователь не авторизован          | Нет данных                                                 |
| **404** | OTP не найден                        | Нет данных                                                 |
| **422** | Ошибка валидации входных параметров  | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `POST` /accounts/otp/login

**Авторизуемся по OTP**

Авторизуемся по выданному одноразовому паролю

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `790d35f354c43efd3523b84a80ead587`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле        | Тип       | Обязательное | Описание | Пример                                   |
| :---------- | :-------- | :----------- | :------- | :--------------------------------------- |
| `code`      | `integer` | **Да**       | -        | `54233`                                  |
| `device_id` | `string`  | **Да**       | -        | `"n702175b-fa52-5251-a39z-d1f4af0w1cak"` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "code": 54233,
  "device_id": "n702175b-fa52-5251-a39z-d1f4af0w1cak"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                               |
| :------ | :---------------------------------- | :--------------------------------------------------------- |
| **200** | Токен авторизации                   | `application/json` (responses.api.v1.accounts.otp.login)   |
| **401** | OTP не привязан к пользователю      | Нет данных                                                 |
| **404** | OTP не найден                       | Нет данных                                                 |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле    | Тип      | Обязательное | Описание | Пример                                                                                                     |
| :------ | :------- | :----------- | :------- | :--------------------------------------------------------------------------------------------------------- |
| `token` | `string` | Нет          | -        | `"eyJpdiI6ImJDeElkYzliNFBDb2VFMDdtdnZpdVE9PSIsInZhbHVlIjoiM0Y5SnVINno3NndBbUcvU2NPVjJhMmhTMllJdWd4WUlF=="` |

```json
{
  "token": "eyJpdiI6ImJDeElkYzliNFBDb2VFMDdtdnZpdVE9PSIsInZhbHVlIjoiM0Y5SnVINno3NndBbUcvU2NPVjJhMmhTMllJdWd4WUlF=="
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

### Аккаунты.Пользователи.Авторизация

#### `POST` /accounts/users/auth/login

**Авторизация пользователя**

Авторизация пользователя по логину и паролю. Создание сессии пользователя, выдача токена авторизации для использования в cookies или в Bearer Token

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `14fa6a915a5b4509014a513e36168abd`

##### Тело запроса (Request Body)

Авторизационные данные

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле       | Тип      | Обязательное | Описание | Пример             |
| :--------- | :------- | :----------- | :------- | :----------------- |
| `login`    | `string` | **Да**       | -        | `"animeshnik_488"` |
| `password` | `string` | **Да**       | -        | `"password"`       |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "login": "animeshnik_488",
  "password": "password"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                                             | Схема ответа                                                |
| :------ | :--------------------------------------------------- | :---------------------------------------------------------- |
| **200** | Токен авторизации                                    | `application/json` (responses.v1.accounts.users.auth.login) |
| **401** | Не удалось авторизоваться. Неправильные логин/пароль | Нет данных                                                  |
| **422** | Не указан логин и/или пароль                         | Нет данных                                                  |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле    | Тип      | Обязательное | Описание | Пример                                                                                                                                                                                                                                                   |
| :------ | :------- | :----------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token` | `string` | Нет          | -        | `"eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="` |

```json
{
  "token": "eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="
}
```
</details>

---

#### `POST` /accounts/users/auth/logout

**Деавторизация пользователя**

Деавторизовать пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `132d66679910512b70001a8bb5f25141`

##### Ответы (Responses)

| Код     | Описание                                                 | Схема ответа                                                 |
| :------ | :------------------------------------------------------- | :----------------------------------------------------------- |
| **200** | Результат деавторизации                                  | `application/json` (responses.v1.accounts.users.auth.logout) |
| **401** | Не удалось деавторизоваться. Пользователь не авторизован | Нет данных                                                   |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле    | Тип    | Обязательное | Описание | Пример   |
| :------ | :----- | :----------- | :------- | :------- |
| `token` | `null` | Нет          | -        | `"null"` |

```json
{
  "token": "null"
}
```
</details>

---

### Аккаунты.Пользователи.Авторизация.СоциальныеСети

#### `GET` /accounts/users/auth/social/{provider}/login

**Авторизация пользователя через социальные сети**

Позволяет авторизовать пользователя через некоторые социальные сети

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `0095f8a8662997958527805d12c27324`

##### Параметры запроса

| Имя        | Расположение | Тип                                     | Обязательный | Описание                  | Пример |
| :--------- | :----------- | :-------------------------------------- | :----------- | :------------------------ | :----- |
| `provider` | `path`       | `enums.accounts.users.user.social.type` | **Да**       | Провайдер социальной сети | `"vk"` |

##### Ответы (Responses)

| Код     | Описание                                          | Схема ответа                                                       |
| :------ | :------------------------------------------------ | :----------------------------------------------------------------- |
| **200** | Данные для авторизации в социальной сети          | `application/json` (responses.v1.accounts.users.auth.social.login) |
| **404** | Указанный провайдер социальной сети не существует | Нет данных                                                         |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле    | Тип      | Обязательное | Описание                                                    | Пример                                                                                                                              |
| :------ | :------- | :----------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `url`   | `string` | Нет          | Ссылка на oauth авторизацию через указанную социальную сеть | `"https://oauth.vk.com/authorize?client_id=&redirect_uri=&scope=email&response_type=code&state=9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc"` |
| `state` | `string` | Нет          | Ключ для аутентификации пройденной авторизации              | `"9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc"`                                                                                              |

```json
{
  "url": "https://oauth.vk.com/authorize?client_id=&redirect_uri=&scope=email&response_type=code&state=9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc",
  "state": "9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc"
}
```
</details>

---

#### `GET` /accounts/users/auth/social/authenticate

**Аутентифицировать пользователя через социальные сети**

Позволяет аутентифицировать авторизованного через социальную сеть пользователя

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `42e1d4b7dc7676b933bcc6bf6a9109cf`

##### Параметры запроса

| Имя     | Расположение | Тип      | Обязательный | Описание            | Пример |
| :------ | :----------- | :------- | :----------- | :------------------ | :----- |
| `state` | `query`      | `string` | **Да**       | Ключ аутентификации | -      |

##### Ответы (Responses)

| Код     | Описание                                                              | Схема ответа                                                              |
| :------ | :-------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **200** | Токен авторизации                                                     | `application/json` (responses.v1.accounts.users.auth.social.authenticate) |
| **404** | Ключ аутентификации не существует или пользователь еще не авторизован | Нет данных                                                                |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле    | Тип      | Обязательное | Описание              | Пример                                                                                                                                                                                                                                                   |
| :------ | :------- | :----------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token` | `string` | Нет          | JWT токен авторизации | `"eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="` |

```json
{
  "token": "eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="
}
```
</details>

---

### Аккаунты.Пользователи.Авторизация.Пароль

#### `POST` /accounts/users/auth/password/forget

**Восстановление пароля**

Отправление ссылки на восстановление забытого пароля

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `d549714f7696a9126c11c3254303cbe8`

##### Тело запроса (Request Body)

Данные для восстановления

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле    | Тип      | Обязательное | Описание | Пример                              |
| :------ | :------- | :----------- | :------- | :---------------------------------- |
| `email` | `string` | **Да**       | -        | `"my_cool_anime_email@example.com"` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "email": "my_cool_anime_email@example.com"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание          | Схема ответа |
| :------ | :---------------- | :----------- |
| **200** | Письмо отправлено | Нет данных   |

---

#### `POST` /accounts/users/auth/password/reset

**Сброс и установка нового пароля**

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `96e405c4aad009c4c555165b0657b576`

##### Тело запроса (Request Body)

Новые данные пользователя

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле                    | Тип      | Обязательное | Описание | Пример                |
| :---------------------- | :------- | :----------- | :------- | :-------------------- |
| `token`                 | `string` | **Да**       | -        | `"token_from_email"`  |
| `password`              | `string` | **Да**       | -        | `"myNewCoolPassword"` |
| `password_confirmation` | `string` | **Да**       | -        | `"myNewCoolPassword"` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "token": "token_from_email",
  "password": "myNewCoolPassword",
  "password_confirmation": "myNewCoolPassword"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                               |
| :------ | :---------------------------------- | :--------------------------------------------------------- |
| **200** | Пароль успешно сброшен              | Нет данных                                                 |
| **404** | Данные не найдены                   | Нет данных                                                 |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

### Аккаунты.Пользователи.Мое.Коллекции.Справочники

#### `GET` /accounts/users/me/collections/references/age-ratings

**Список возрастных рейтингов в коллекциях пользователя**

Возвращает список возрастных рейтингов в коллекциях текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `8b157a7586e3c56605e42d0d328ad854`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                              |
| :------ | :-------------------------- | :---------------------------------------------------------------------------------------- |
| **200** | Список возрастных рейтингов | `application/json` (responses.api.v1.accounts.users.me.collections.references.ageRatings) |
| **403** | Пользователь не авторизован | Нет данных                                                                                |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "R0_PLUS",
    "label": "string",
    "description": "string"
  }
]
```
</details>

---

#### `GET` /accounts/users/me/collections/references/genres

**Список жанров в коллекциях пользователя**

Возвращает список жанров в коллекциях текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `cdedb51df9d04015c63f820e18ae98d4`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                          |
| :------ | :-------------------------- | :------------------------------------------------------------------------------------ |
| **200** | Список жанров               | `application/json` (responses.api.v1.accounts.users.me.collections.references.genres) |
| **403** | Пользователь не авторизован | Нет данных                                                                            |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 0,
    "name": "string"
  }
]
```
</details>

---

#### `GET` /accounts/users/me/collections/references/types

**Список типов в коллекциях пользователя**

Возвращает список типов в коллекциях текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `3bfa46759da920c8dfb3ab23f95b2b83`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                         |
| :------ | :-------------------------- | :----------------------------------------------------------------------------------- |
| **200** | Список типов                | `application/json` (responses.api.v1.accounts.users.me.collections.references.types) |
| **403** | Пользователь не авторизован | Нет данных                                                                           |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "TV",
    "description": "string"
  }
]
```
</details>

---

#### `GET` /accounts/users/me/collections/references/years

**Список годов в коллекциях пользователя**

Возвращает список годов в коллекциях текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `7adae426acd92ba3f282eb1cb38ce4c4`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                         |
| :------ | :-------------------------- | :----------------------------------------------------------------------------------- |
| **200** | Список годов                | `application/json` (responses.api.v1.accounts.users.me.collections.references.years) |
| **403** | Пользователь не авторизован | Нет данных                                                                           |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[2020, 2021, 2022, 2023]
```
</details>

---

### Аккаунты.Пользователи.Мое.Коллекции

#### `GET` /accounts/users/me/collections/ids

**Список идентификаторов релизов добавленных в коллекции**

Возвращает данные по идентификаторам релизов и типов коллекций авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `3952a0264ef53d5cebaebac72b70ea2a`

##### Ответы (Responses)

| Код     | Описание                                         | Схема ответа               |
| :------ | :----------------------------------------------- | :------------------------- |
| **200** | Список идентификаторов релизов и типов коллекций | `application/json` (array) |
| **403** | Необходимо авторизоваться                        | Нет данных                 |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[[]]
```
</details>

---

#### `GET` /accounts/users/me/collections/releases

**Список релизов добавленных в коллекцию [GET]**

Возвращает данные по релизам из определенной коллекции авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `ff552f54874b00625454339a7c989109`

##### Параметры запроса

| Имя                  | Расположение | Тип                                               | Обязательный | Описание                                                                                                                           | Пример                   |
| :------------------- | :----------- | :------------------------------------------------ | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :----------------------- |
| `page`               | `query`      | `integer`                                         | Нет          | Номер страницы                                                                                                                     | `1`                      |
| `limit`              | `query`      | `integer`                                         | Нет          | Ограничение на количество элементов                                                                                                | `10`                     |
| `type_of_collection` | `query`      | `enums.accounts.users.user.collection.type`       | **Да**       | Тип коллекции                                                                                                                      | `"RATING_DESC"`          |
| `f[genres]`          | `query`      | `object`                                          | Нет          | Список идентификаторов жанров                                                                                                      | `"15,20"`                |
| `f[types]`           | `query`      | array of `enums.anime.releases.release.type`      | Нет          | Список типов релизов                                                                                                               | `["TV","WEB"]`           |
| `f[years]`           | `query`      | `object`                                          | Нет          | Минимальный год выхода релиза                                                                                                      | `"2016, 2018, 2019"`     |
| `f[search]`          | `query`      | `object`                                          | Нет          | Поисковый запрос                                                                                                                   | `"Мастера меча"`         |
| `f[age_ratings]`     | `query`      | array of `enums.anime.releases.release.ageRating` | Нет          | Список возрастных рейтингов                                                                                                        | `["R6_PLUS","R12_PLUS"]` |
| `include`            | `query`      | `object`                                          | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`       |
| `exclude`            | `query`      | `object`                                          | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"`   |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                          |
| :------ | :---------------------------------- | :-------------------------------------------------------------------- |
| **200** | Список релизов                      | `application/json` (responses.v1.accounts.users.collections.releases) |
| **403** | Необходимо авторизоваться           | Нет данных                                                            |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)            |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `POST` /accounts/users/me/collections/releases

**Список релизов добавленных в коллекцию [POST]**

Возвращает данные по релизам из определенной коллекции авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `713f5e158bb307116510418108b79ab2`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле                 | Тип                                                                                | Обязательное | Описание                      | Пример                       |
| :------------------- | :--------------------------------------------------------------------------------- | :----------- | :---------------------------- | :--------------------------- |
| `page`               | `integer`                                                                          | Нет          | -                             | `1`                          |
| `limit`              | `integer`                                                                          | Нет          | -                             | `15`                         |
| `type_of_collection` | `string ["PLANNED", "WATCHED", "WATCHING", "POSTPONED", "ABANDONED"]`              | Нет          | Тип коллекции                 | `"PLANNED"`                  |
| `f`                  | `object`                                                                           | Нет          | -                             | -                            |
| `f.genres`           | `string`                                                                           | Нет          | Список идентификаторов жанров | `"15,20"`                    |
| `f.types`            | array of `string ["TV", "ONA", "WEB", "OVA", "OAD", "MOVIE", "DORAMA", "SPECIAL"]` | Нет          | Список типов релизов          | `["TV","WEB"]`               |
| `f.years`            | `string`                                                                           | Нет          | Минимальный год выхода релиза | `"2016, 2018, 2019"`         |
| `f.search`           | `string`                                                                           | Нет          | Поисковый запрос              | `"Мастера меча"`             |
| `f.age_ratings`      | array of `string ["R0_PLUS", "R6_PLUS", "R12_PLUS", "R16_PLUS", "R18_PLUS"]`       | Нет          | Список возрастных рейтингов   | `["R6_PLUS","R12_PLUS"]`     |
| `include`            | `string`                                                                           | Нет          | -                             | `"id,type.description"`      |
| `exclude`            | `string`                                                                           | Нет          | -                             | `"season.value,description"` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "page": 1,
  "limit": 15,
  "type_of_collection": "PLANNED",
  "f": {
    "genres": "15,20",
    "types": ["TV", "WEB"],
    "years": "2016, 2018, 2019",
    "search": "Мастера меча",
    "age_ratings": ["R6_PLUS", "R12_PLUS"]
  },
  "include": "id,type.description",
  "exclude": "season.value,description"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                          |
| :------ | :---------------------------------- | :-------------------------------------------------------------------- |
| **200** | Список релизов                      | `application/json` (responses.v1.accounts.users.collections.releases) |
| **403** | Необходимо авторизоваться           | Нет данных                                                            |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)            |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `POST` /accounts/users/me/collections

**Добавить релизы в коллекции**

Добавляет релизы в соответствующие коллекции авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `cfc448915a4cb9569951de2b0118db9d`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

<details><summary>Пример тела запроса (JSON)</summary>

```json
[
  {
    "release_id": 0,
    "type_of_collection": "PLANNED"
  }
]
```
</details>

##### Ответы (Responses)

| Код     | Описание                             | Схема ответа                                               |
| :------ | :----------------------------------- | :--------------------------------------------------------- |
| **200** | Релизы успешно добавлены в коллекции | `application/json` (array)                                 |
| **403** | Необходимо авторизоваться            | Нет данных                                                 |
| **422** | Ошибка валидации входных параметров  | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[[]]
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `DELETE` /accounts/users/me/collections

**Удалить релизы из коллекций**

Удаляет релизы из соответствующих коллекций авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `e7c7a8cb031577e009c11a5128c63191`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

<details><summary>Пример тела запроса (JSON)</summary>

```json
[
  {
    "release_id": 0
  }
]
```
</details>

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                               |
| :------ | :---------------------------------- | :--------------------------------------------------------- |
| **200** | Релизы успешно удалены              | `application/json` (array)                                 |
| **403** | Необходимо авторизоваться           | Нет данных                                                 |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[[]]
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

### Аккаунты.Пользователи.Мое.Избранное.Справочники

#### `GET` /accounts/users/me/favorites/references/age-ratings

**Список возрастных рейтингов в избранном пользователя**

Возвращает список возрастных рейтингов в избранном текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `0079b1666727fca03a65def7b2882ce7`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                            |
| :------ | :-------------------------- | :-------------------------------------------------------------------------------------- |
| **200** | Список возрастных рейтингов | `application/json` (responses.api.v1.accounts.users.me.favorites.references.ageRatings) |
| **403** | Пользователь не авторизован | Нет данных                                                                              |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "R0_PLUS",
    "label": "string",
    "description": "string"
  }
]
```
</details>

---

#### `GET` /accounts/users/me/favorites/references/genres

**Список жанров в избранном пользователя**

Возвращает список жанров в избранном текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `5714dc01fd354c98f2a92e9103f41df3`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                        |
| :------ | :-------------------------- | :---------------------------------------------------------------------------------- |
| **200** | Список жанров               | `application/json` (responses.api.v1.accounts.users.me.favorites.references.genres) |
| **403** | Пользователь не авторизован | Нет данных                                                                          |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 0,
    "name": "string"
  }
]
```
</details>

---

#### `GET` /accounts/users/me/favorites/references/sorting

**Список опций сортировки в избранном пользователя**

Возвращает список опций сортировки в избранном текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `4d9e1c473afa35932a2daf2715d7657c`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                         |
| :------ | :-------------------------- | :----------------------------------------------------------------------------------- |
| **200** | Список опций сортировки     | `application/json` (responses.api.v1.accounts.users.me.favorites.references.sorting) |
| **403** | Пользователь не авторизован | Нет данных                                                                           |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "CREATED_AT_DESC",
    "label": "string",
    "description": "string"
  }
]
```
</details>

---

#### `GET` /accounts/users/me/favorites/references/types

**Список типов релизов в избранном пользователя**

Возвращает список типов релизов в избранном текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `8c7dd07d3f58867144a0fd88482aadac`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                       |
| :------ | :-------------------------- | :--------------------------------------------------------------------------------- |
| **200** | Список типов релизов        | `application/json` (responses.api.v1.accounts.users.me.favorites.references.types) |
| **403** | Пользователь не авторизован | Нет данных                                                                         |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "TV",
    "description": "string"
  }
]
```
</details>

---

#### `GET` /accounts/users/me/favorites/references/years

**Список годов выхода релизов в избранном пользователя**

Возвращает список годов выхода релизов в избранном текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `da82e99bb7f630094ff8adb44cc9da5e`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                                       |
| :------ | :-------------------------- | :--------------------------------------------------------------------------------- |
| **200** | Список годов выхода релизов | `application/json` (responses.api.v1.accounts.users.me.favorites.references.years) |
| **403** | Пользователь не авторизован | Нет данных                                                                         |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[2020, 2021, 2022, 2023]
```
</details>

---

### Аккаунты.Пользователи.Мое.Избранное

#### `GET` /accounts/users/me/favorites/ids

**Список идентификаторов релизов добавленных в избранное**

Возвращает данные по идентификаторам релизов из избранного авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `4706b730c52b2dfad48751c7c10757dc`

##### Ответы (Responses)

| Код     | Описание                     | Схема ответа                                                      |
| :------ | :--------------------------- | :---------------------------------------------------------------- |
| **200** | Список релизов из избранного | `application/json` (responses.v1.accounts.users.me.favorites.ids) |
| **403** | Необходимо авторизоваться    | Нет данных                                                        |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[9023, 9024, 9025]
```
</details>

---

#### `GET` /accounts/users/me/favorites/releases

**Список релизов в избранном пользователя**

Возвращает данные по релизам из избранного текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `5baafd8eec6b0a60ff67a4ac6038f4a9`

##### Параметры запроса

| Имя              | Расположение | Тип                                                 | Обязательный | Описание                                                                                                                           | Пример                   |
| :--------------- | :----------- | :-------------------------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :----------------------- |
| `page`           | `query`      | `integer`                                           | Нет          | Номер страницы                                                                                                                     | `1`                      |
| `limit`          | `query`      | `integer`                                           | Нет          | Ограничение на количество элементов                                                                                                | `10`                     |
| `f[years]`       | `query`      | `object`                                            | Нет          | Года выхода релиза                                                                                                                 | `"2016, 2018, 2019"`     |
| `f[types]`       | `query`      | array of `enums.anime.releases.release.type`        | Нет          | Список типов релизов                                                                                                               | `["TV","WEB"]`           |
| `f[genres]`      | `query`      | `object`                                            | Нет          | Список идентификаторов жанров                                                                                                      | `"15,20"`                |
| `f[search]`      | `query`      | `object`                                            | Нет          | Поисковый запрос                                                                                                                   | `"Мастера меча"`         |
| `f[sorting]`     | `query`      | `enums.accounts.users.user.favorite.filter.sorting` | Нет          | Тип сортировки                                                                                                                     | `"RATING_DESC"`          |
| `f[age_ratings]` | `query`      | array of `enums.anime.releases.release.ageRating`   | Нет          | Список возрастных рейтингов                                                                                                        | `["R6_PLUS","R12_PLUS"]` |
| `include`        | `query`      | `object`                                            | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`       |
| `exclude`        | `query`      | `object`                                            | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"`   |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                           |
| :------ | :---------------------------------- | :--------------------------------------------------------------------- |
| **200** | Список релизов                      | `application/json` (responses.v1.accounts.users.me.favorites.releases) |
| **403** | Необходимо авторизоваться           | Нет данных                                                             |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)             |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `POST` /accounts/users/me/favorites/releases

**Список релизов в избранном пользователя**

Возвращает данные по релизам из избранного текущего пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `89e379bb7614921658d8cbaa36b8cbdd`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле            | Тип                                                                                                                                   | Обязательное | Описание                      | Пример                       |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :----------- | :---------------------------- | :--------------------------- |
| `page`          | `integer`                                                                                                                             | Нет          | Страница в выдаче             | `1`                          |
| `limit`         | `integer`                                                                                                                             | Нет          | Количество релизов в выдаче   | `15`                         |
| `f`             | `object`                                                                                                                              | Нет          | -                             | -                            |
| `f.years`       | `string`                                                                                                                              | Нет          | Года выхода релиза            | `"2016, 2018, 2019"`         |
| `f.types`       | array of `string ["TV", "ONA", "WEB", "OVA", "OAD", "MOVIE", "DORAMA", "SPECIAL"]`                                                    | Нет          | Список типов релизов          | `["TV","WEB"]`               |
| `f.genres`      | `string`                                                                                                                              | Нет          | Список идентификаторов жанров | `"15,20"`                    |
| `f.search`      | `string`                                                                                                                              | Нет          | Поисковый запрос              | `"Мастера меча"`             |
| `f.sorting`     | `string ["CREATED_AT_DESC", "CREATED_AT_ASC", "FRESH_AT_DESC", "FRESH_AT_ASC", "RATING_DESC", "RATING_ASC", "YEAR_DESC", "YEAR_ASC"]` | Нет          | -                             | -                            |
| `f.age_ratings` | array of `string ["R0_PLUS", "R6_PLUS", "R12_PLUS", "R16_PLUS", "R18_PLUS"]`                                                          | Нет          | Список возрастных рейтингов   | `["R6_PLUS","R12_PLUS"]`     |
| `include`       | `string`                                                                                                                              | Нет          | -                             | `"id,type.description"`      |
| `exclude`       | `string`                                                                                                                              | Нет          | -                             | `"season.value,description"` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "page": 1,
  "limit": 15,
  "f": {
    "years": "2016, 2018, 2019",
    "types": ["TV", "WEB"],
    "genres": "15,20",
    "search": "Мастера меча",
    "sorting": "CREATED_AT_DESC",
    "age_ratings": ["R6_PLUS", "R12_PLUS"]
  },
  "include": "id,type.description",
  "exclude": "season.value,description"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                           |
| :------ | :---------------------------------- | :--------------------------------------------------------------------- |
| **200** | Список релизов                      | `application/json` (responses.v1.accounts.users.me.favorites.releases) |
| **403** | Необходимо авторизоваться           | Нет данных                                                             |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)             |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `POST` /accounts/users/me/favorites

**Добавить релизы в избранное**

Добавляет релизы в избранное авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `7050ee79698aa22d0b67d8d6a1ec5a3b`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

<details><summary>Пример тела запроса (JSON)</summary>

```json
[
  {
    "release_id": 9023
  }
]
```
</details>

##### Ответы (Responses)

| Код     | Описание                             | Схема ответа                                                         |
| :------ | :----------------------------------- | :------------------------------------------------------------------- |
| **200** | Релизы успешно добавлены в избранное | `application/json` (responses.v1.accounts.users.me.favorites.update) |
| **403** | Необходимо авторизоваться            | Нет данных                                                           |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[9023, 9024, 9025]
```
</details>

---

#### `DELETE` /accounts/users/me/favorites

**Удалить релизы из избранного**

Удаляет релизы из избранного авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `1d04983f0ba43d7c0ad3be4bc567de1f`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

<details><summary>Пример тела запроса (JSON)</summary>

```json
[
  {
    "release_id": 9023
  }
]
```
</details>

##### Ответы (Responses)

| Код     | Описание                  | Схема ответа                                                         |
| :------ | :------------------------ | :------------------------------------------------------------------- |
| **200** | Релизы успешно удалены    | `application/json` (responses.v1.accounts.users.me.favorites.delete) |
| **403** | Необходимо авторизоваться | Нет данных                                                           |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[9021, 9022]
```
</details>

---

### Аккаунты.Пользователи.Мое.Профиль

#### `GET` /accounts/users/me/profile

**Профиль авторизованного пользователя**

Возвращает данные профиля авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `69fcaa197a8b8cf6c6a4b8dd655ff0f2`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                              |
| :------ | :-------------------------- | :---------------------------------------- |
| **200** | Данные профиля пользователя | `application/json` (models.users.v1.user) |
| **403** | Необходимо авторизоваться   | Нет данных                                |
| **404** | Пользователь не авторизован | Нет данных                                |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                  | Тип                  | Обязательное | Описание                                 | Пример                            |
| :-------------------- | :------------------- | :----------- | :--------------------------------------- | :-------------------------------- |
| `id`                  | `integer`            | Нет          | Transform pattern                        | `4837362`                         |
| `login`               | `string`             | Нет          | Отображается только собственный          | `"animeshnik_488"`                |
| `email`               | `string`             | Нет          | Отображается только собственный          | `"animeshnik_488@protonmail.com"` |
| `nickname`            | `string`             | Нет          | -                                        | `"Animeshnik488"`                 |
| `avatar`              | `object`             | Нет          | -                                        | -                                 |
| `torrents`            | `object`             | Нет          | Данные по торрентам                      | -                                 |
| `torrents.passkey`    | `string`             | Нет          | passkey, отображается только собственный | `"xBSmRDA95bJXPk3E"`              |
| `torrents.uploaded`   | `integer`            | Нет          | Количество отданного, в байтах           | `998234623`                       |
| `torrents.downloaded` | `integer`            | Нет          | Количество скачанного, в байтах          | `2397162874432`                   |
| `is_banned`           | `boolean`            | Нет          | Забанен ли пользоваель в данный момент   | `true`                            |
| `created_at`          | `string (date-time)` | Нет          | -                                        | `"2019-03-31T20:43:52+00:00"`     |
| `is_with_ads`         | `boolean`            | Нет          | Отображение рекламы                      | `false`                           |

```json
{
  "id": 4837362,
  "login": "animeshnik_488",
  "email": "animeshnik_488@protonmail.com",
  "nickname": "Animeshnik488",
  "avatar": {},
  "torrents": {
    "passkey": "xBSmRDA95bJXPk3E",
    "uploaded": 998234623,
    "downloaded": 2397162874432
  },
  "is_banned": true,
  "created_at": "2019-03-31T20:43:52+00:00",
  "is_with_ads": false
}
```
</details>

---

### Аккаунты.Пользователи.Мое.Просмотры

#### `GET` /accounts/users/me/views/history

**История просмотренных эпизодов**

Возвращает историю просмотров эпизодов авторизованного пользователя

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `98e2d85bdf06f190dde743b204aacaa0`

##### Параметры запроса

| Имя       | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `page`    | `query`      | `integer` | Нет          | Номер страницы                                                                                                                     | `1`                    |
| `limit`   | `query`      | `integer` | Нет          | Ограничение на количество элементов                                                                                                | `10`                   |
| `include` | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                      |
| :------ | :---------------------------------- | :---------------------------------------------------------------- |
| **200** | История просмотров                  | `application/json` (responses.v1.accounts.users.me.views.history) |
| **403** | Необходимо авторизоваться           | Нет данных                                                        |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)        |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `GET` /accounts/users/me/views/timecodes

**Таймкоды просмотренных эпизодов**

Возвращает таймкоды по прогрессу просмотренных эпизодов

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `8c43236d8913f7775c5c4781ed2a1aff`

##### Параметры запроса

| Имя     | Расположение | Тип                  | Обязательный | Описание                                                                                    | Пример                      |
| :------ | :----------- | :------------------- | :----------- | :------------------------------------------------------------------------------------------ | :-------------------------- |
| `since` | `query`      | `string (date-time)` | Нет          | Возвращает только таймкоды, которые были добавлены после указанного времени (в iso формате) | `"2025-05-12T07:20:50.52Z"` |

##### Ответы (Responses)

| Код     | Описание                                | Схема ответа               |
| :------ | :-------------------------------------- | :------------------------- |
| **200** | Список таймкодов просмотренных эпизодов | `application/json` (array) |
| **403** | Необходимо авторизоваться               | Нет данных                 |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[[]]
```
</details>

---

#### `POST` /accounts/users/me/views/timecodes

**Обновление таймкодов прогресса просмотренного эпизода**

Обновляет таймкоды просмотренных эпизодов

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `de259a20def1fb0f5237f3f3ceb477ea`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

<details><summary>Пример тела запроса (JSON)</summary>

```json
[
  {
    "time": 743.5,
    "is_watched": true,
    "release_episode_id": "68d4d5c5-e3d5-419f-a21c-c511b6b251f5"
  }
]
```
</details>

##### Ответы (Responses)

| Код     | Описание                                          | Схема ответа |
| :------ | :------------------------------------------------ | :----------- |
| **200** | Таймкоды просмотренных эпизодов обновлены успешно | Нет данных   |
| **403** | Необходимо авторизоваться                         | Нет данных   |

---

#### `DELETE` /accounts/users/me/views/timecodes

**Удаление таймкодов просмотра эпизодов**

Удаляет данные по таймкодам просмотров для указанных эпизодов

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `04d4073f12d50d4998b33ce7bbc94d8b`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

<details><summary>Пример тела запроса (JSON)</summary>

```json
[
  {
    "release_episode_id": "9c5f39e1-56dd-4d44-950a-e1a4201426a4"
  }
]
```
</details>

##### Ответы (Responses)

| Код     | Описание                                        | Схема ответа |
| :------ | :---------------------------------------------- | :----------- |
| **200** | Таймкоды просмотренных эпизодов удалены успешно | Нет данных   |
| **403** | Необходимо авторизоваться                       | Нет данных   |

---

### Реклама.Vasts

#### `GET` /media/vasts

**Список возможных VAST реклам**

Возвращает список со всеми доступными для использования VAST кампаниями

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `5ace32aaaadd1b77c3d172d6b952a502`

##### Ответы (Responses)

| Код     | Описание | Схема ответа                                    |
| :------ | :------- | :---------------------------------------------- |
| **200** | Vasts    | `application/json` (responses.api.v1.ads.vasts) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": "17974e6e-da62-427b-9937-9021cf4cafe4",
    "url": "https://example.com/vast.xml",
    "ad_erid": "ERID123456789",
    "ad_company_itn": "1234567890",
    "ad_company_name": "Company XYZ"
  }
]
```
</details>

---

#### `GET` /media/manifest.xml

**VAST XML с цепочкой реклам**

Возвращает XML страницу со всеми доступными для использования VAST кампаниями. Можно просто отдавать этот URL в любой VAST плеер, который поддерживает загрузку vast XML по url

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `71b3eb0cca9e96d4fc48d0d77fa35eab`

##### Ответы (Responses)

| Код     | Описание | Схема ответа      |
| :------ | :------- | :---------------- |
| **200** | XML VAST | `application/xml` |

---

### Аниме.Каталог

#### `GET` /anime/catalog/releases

**Список релизов в каталоге**

Возвращает список релизов по заданными параметрам

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `deb730a26ed7580e04c822a12b782831`

##### Параметры запроса

| Имя                      | Расположение | Тип                                                    | Обязательный | Описание                                                                                                                           | Пример                   |
| :----------------------- | :----------- | :----------------------------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :----------------------- |
| `page`                   | `query`      | `integer`                                              | Нет          | Номер страницы                                                                                                                     | `1`                      |
| `limit`                  | `query`      | `integer`                                              | Нет          | Ограничение на количество элементов                                                                                                | `10`                     |
| `f[genres]`              | `query`      | `object`                                               | Нет          | Список идентификаторов жанров                                                                                                      | `"15,20"`                |
| `f[types]`               | `query`      | array of `enums.anime.releases.release.type`           | Нет          | Список типов релизов                                                                                                               | `["TV","WEB"]`           |
| `f[seasons]`             | `query`      | array of `enums.anime.releases.release.season`         | Нет          | Список сезонов релизов                                                                                                             | `["winter","autumn"]`    |
| `f[years][from_year]`    | `query`      | `object`                                               | Нет          | Минимальный год выхода релиза                                                                                                      | `"2016"`                 |
| `f[years][to_year]`      | `query`      | `object`                                               | Нет          | Максимальный год выхода релиза                                                                                                     | `"2020"`                 |
| `f[search]`              | `query`      | `object`                                               | Нет          | Поиск запрос                                                                                                                       | `"Мастера меча"`         |
| `f[sorting]`             | `query`      | `enums.anime.catalog.filter.sorting`                   | Нет          | Тип сортировки                                                                                                                     | `"RATING_DESC"`          |
| `f[age_ratings]`         | `query`      | array of `enums.anime.releases.release.ageRating`      | Нет          | Список возрастных рейтингов                                                                                                        | `["R6_PLUS","R12_PLUS"]` |
| `f[publish_statuses]`    | `query`      | array of `enums.anime.catalog.filter.publishStatus`    | Нет          | Список статусов релизов                                                                                                            | `"IS_ONGOING"`           |
| `f[production_statuses]` | `query`      | array of `enums.anime.catalog.filter.productionStatus` | Нет          | Список статусов релизов                                                                                                            | `"IS_IN_PRODUCTION"`     |
| `include`                | `query`      | `object`                                               | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`       |
| `exclude`                | `query`      | `object`                                               | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"`   |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                 |
| :------ | :---------------------------------- | :----------------------------------------------------------- |
| **200** | Список релизов                      | `application/json` (responses.api.v1.anime.catalog.releases) |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)   |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `POST` /anime/catalog/releases

**Список релизов в каталоге**

Возвращает список релизов по заданными параметрам

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `1774e330982ade57101c5af1a263b3ad`

##### Тело запроса (Request Body)

**Тип содержимого:** `application/json` _(Обязательно)_

| Поле                    | Тип                                                                                              | Обязательное | Описание | Пример                       |
| :---------------------- | :----------------------------------------------------------------------------------------------- | :----------- | :------- | :--------------------------- |
| `page`                  | `integer`                                                                                        | Нет          | -        | `1`                          |
| `limit`                 | `integer`                                                                                        | Нет          | -        | `15`                         |
| `f`                     | `object`                                                                                         | Нет          | -        | -                            |
| `f.genres`              | array of `integer`                                                                               | Нет          | -        | `[15,20]`                    |
| `f.types`               | array of `string ["TV", "ONA", "WEB", "OVA", "OAD", "MOVIE", "DORAMA", "SPECIAL"]`               | Нет          | -        | `["TV","WEB"]`               |
| `f.seasons`             | array of `string ["winter", "spring", "summer", "autumn"]`                                       | Нет          | -        | `["winter","autumn"]`        |
| `f.years`               | `object`                                                                                         | Нет          | -        | -                            |
| `f.years.from_year`     | `integer`                                                                                        | Нет          | -        | `2016`                       |
| `f.years.to_year`       | `integer`                                                                                        | Нет          | -        | `2020`                       |
| `f.search`              | `string`                                                                                         | Нет          | -        | `"Мастера меча"`             |
| `f.sorting`             | `string ["FRESH_AT_DESC", "FRESH_AT_ASC", "RATING_DESC", "RATING_ASC", "YEAR_DESC", "YEAR_ASC"]` | Нет          | -        | -                            |
| `f.age_ratings`         | array of `string ["R0_PLUS", "R6_PLUS", "R12_PLUS", "R16_PLUS", "R18_PLUS"]`                     | Нет          | -        | `["R6_PLUS","R12_PLUS"]`     |
| `f.publish_statuses`    | array of `string ["IS_ONGOING", "IS_NOT_ONGOING"]`                                               | Нет          | -        | `["IS_ONGOING"]`             |
| `f.production_statuses` | array of `string ["IS_IN_PRODUCTION", "IS_NOT_IN_PRODUCTION"]`                                   | Нет          | -        | `["IS_IN_PRODUCTION"]`       |
| `include`               | `string`                                                                                         | Нет          | -        | `"id,type.description"`      |
| `exclude`               | `string`                                                                                         | Нет          | -        | `"season.value,description"` |

<details><summary>Пример тела запроса (JSON)</summary>

```json
{
  "page": 1,
  "limit": 15,
  "f": {
    "genres": [15, 20],
    "types": ["TV", "WEB"],
    "seasons": ["winter", "autumn"],
    "years": {
      "from_year": 2016,
      "to_year": 2020
    },
    "search": "Мастера меча",
    "sorting": "FRESH_AT_DESC",
    "age_ratings": ["R6_PLUS", "R12_PLUS"],
    "publish_statuses": ["IS_ONGOING"],
    "production_statuses": ["IS_IN_PRODUCTION"]
  },
  "include": "id,type.description",
  "exclude": "season.value,description"
}
```
</details>

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                 |
| :------ | :---------------------------------- | :----------------------------------------------------------- |
| **200** | Список релизов                      | `application/json` (responses.api.v1.anime.catalog.releases) |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)   |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

### Аниме.Каталог.Справочники

#### `GET` /anime/catalog/references/age-ratings

**Список возрастных рейтингов в каталоге**

Возвращает список возможных возрастных рейтингов в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `7ccd6ec065f6a366883534288e06b946`

##### Ответы (Responses)

| Код     | Описание                    | Схема ответа                                                              |
| :------ | :-------------------------- | :------------------------------------------------------------------------ |
| **200** | Список возрастных рейтингов | `application/json` (responses.api.v1.anime.catalog.references.ageRatings) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "R0_PLUS",
    "label": "PG-17",
    "description": "PG"
  }
]
```
</details>

---

#### `GET` /anime/catalog/references/genres

**Список жанров в каталоге**

Возвращает список всех жанров в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `0849587143559ca91b030ecce1b78924`

##### Ответы (Responses)

| Код     | Описание      | Схема ответа                                                          |
| :------ | :------------ | :-------------------------------------------------------------------- |
| **200** | Список жанров | `application/json` (responses.api.v1.anime.catalog.references.genres) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 23,
    "name": "Мистика"
  }
]
```
</details>

---

#### `GET` /anime/catalog/references/production-statuses

**Список возможных статусов озвучки релиза в каталоге**

Возвращает список возможных статусов озвучки релиза в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `48840b125443cfd04e9def7e82332c74`

##### Ответы (Responses)

| Код     | Описание        | Схема ответа                                                                      |
| :------ | :-------------- | :-------------------------------------------------------------------------------- |
| **200** | Список статусов | `application/json` (responses.api.v1.anime.catalog.references.productionStatuses) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "IS_IN_PRODUCTION",
    "description": "Сейчас в озвучке"
  }
]
```
</details>

---

#### `GET` /anime/catalog/references/publish-statuses

**Список возможных статусов выхода релиза в каталоге**

Возвращает список возможных статусов выхода релиза в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `b05b5536b808dab15831b8ceb0b07b3e`

##### Ответы (Responses)

| Код     | Описание        | Схема ответа                                                                   |
| :------ | :-------------- | :----------------------------------------------------------------------------- |
| **200** | Список статусов | `application/json` (responses.api.v1.anime.catalog.references.publishStatuses) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "IS_ONGOING",
    "description": "Онгоинг"
  }
]
```
</details>

---

#### `GET` /anime/catalog/references/seasons

**Список сезонов релиза в каталоге**

Возвращает список возможных сезонов релизов в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `02c7342e6e3681bd3e68185ed969aef2`

##### Ответы (Responses)

| Код     | Описание               | Схема ответа                                                       |
| :------ | :--------------------- | :----------------------------------------------------------------- |
| **200** | Список сезонов релизов | `application/json` (responses.v1.anime.catalog.references.seasons) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "winter",
    "description": "Зима"
  }
]
```
</details>

---

#### `GET` /anime/catalog/references/sorting

**Список возможных типов сортировок в каталоге**

Возвращает список возможных типов сортировок в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `7d515de59290b809d09c1e61804c7dfd`

##### Ответы (Responses)

| Код     | Описание                | Схема ответа                                                       |
| :------ | :---------------------- | :----------------------------------------------------------------- |
| **200** | Список типов сортировок | `application/json` (responses.v1.anime.catalog.references.sorting) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "FRESH_AT_DESC",
    "label": "Самый низкий рейтинг",
    "description": "Сначала отобразятся самые непопулярные релизы"
  }
]
```
</details>

---

#### `GET` /anime/catalog/references/types

**Список типов релизов в каталоге**

Возвращает список возможных типов релизов в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `00815d61be831012848cb3f964a73701`

##### Ответы (Responses)

| Код     | Описание             | Схема ответа                                                     |
| :------ | :------------------- | :--------------------------------------------------------------- |
| **200** | Список типов релизов | `application/json` (responses.v1.anime.catalog.references.types) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "value": "TV",
    "description": "ТВ"
  }
]
```
</details>

---

#### `GET` /anime/catalog/references/years

**Список годов в каталоге**

Возвращает список годов в каталоге

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `107dd05a40cd2fcfb05ce6f2c9e587b8`

##### Ответы (Responses)

| Код     | Описание     | Схема ответа                                                     |
| :------ | :----------- | :--------------------------------------------------------------- |
| **200** | Список годов | `application/json` (responses.v1.anime.catalog.references.years) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[2020, 2021, 2022, 2023]
```
</details>

---

### Аниме.Франшизы

#### `GET` /anime/franchises

**Получить список франшиз**

Возвращает список франшиз.

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `4bfab3225e23cca7cce5c8e932d261be`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание       | Схема ответа                                       |
| :------ | :------------- | :------------------------------------------------- |
| **200** | Список франшиз | `application/json` (responses.v1.anime.franchises) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": "116e17d2-e89f-4ffc-bfa4-b45ae4c41e92",
    "name": "Re: Жизнь в другом мире с нуля",
    "name_english": "Re: Zero kara Hajimeru Isekai Seikatsu",
    "image": {},
    "rating": 8.45,
    "last_year": 2023,
    "first_year": 2010,
    "total_releases": 10,
    "total_episodes": 25,
    "total_duration": "2 дня 5 часов",
    "total_duration_in_seconds": 183600
  }
]
```
</details>

---

#### `GET` /anime/franchises/{franchiseId}

**Получить франшизу**

Возвращает данные франшизы

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `70ff1847fe22225d4cae12ad31075057`

##### Параметры запроса

| Имя           | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :------------ | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `franchiseId` | `path`       | `string` | **Да**       | ID франшизы                                                                                                                        | -                      |
| `include`     | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`     | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание        | Схема ответа                                      |
| :------ | :-------------- | :------------------------------------------------ |
| **200** | Данные франшизы | `application/json` (responses.v1.anime.franchise) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
{}
```
</details>

---

#### `GET` /anime/franchises/random

**Получить список случайных франшиз**

Возвращает список случайных франшиз.

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `8cad50ab682ef2cb29271df2ba543628`

##### Параметры запроса

| Имя       | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `limit`   | `query`      | `integer` | Нет          | Количество случайных франшиз в выдаче                                                                                              | `4`                    |
| `include` | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание       | Схема ответа                                              |
| :------ | :------------- | :-------------------------------------------------------- |
| **200** | Список франшиз | `application/json` (responses.v1.anime.franchises.random) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": "116e17d2-e89f-4ffc-bfa4-b45ae4c41e92",
    "name": "Re: Жизнь в другом мире с нуля",
    "name_english": "Re: Zero kara Hajimeru Isekai Seikatsu",
    "image": {},
    "rating": 8.45,
    "last_year": 2023,
    "first_year": 2010,
    "total_releases": 10,
    "total_episodes": 25,
    "total_duration": "2 дня 5 часов",
    "total_duration_in_seconds": 183600
  }
]
```
</details>

---

#### `GET` /anime/franchises/release/{releaseId}

**Получить список франшиз для релиза**

Возвращает список франшиз, в которых участвует релиз

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `d27fdeccbad6ce91c882fd615561a4ad`

##### Параметры запроса

| Имя         | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :---------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `releaseId` | `path`       | `string` | **Да**       | ID релиза                                                                                                                          | -                      |
| `include`   | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`   | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание              | Схема ответа                                                 |
| :------ | :-------------------- | :----------------------------------------------------------- |
| **200** | Список франшиз релиза | `application/json` (responses.v1.anime.franchises.byRelease) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[]
```
</details>

---

### Аниме.Жанры

#### `GET` /anime/genres

**Список всех жанров**

Возвращает список всех жанров

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `c674398f4cecb9b21a2d7743b16bd4d5`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                | Схема ответа                                       |
| :------ | :---------------------- | :------------------------------------------------- |
| **200** | Список доступных жанров | `application/json` (responses.api.v1.anime.genres) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 21,
    "name": "Комедия",
    "image": {},
    "total_releases": 10
  }
]
```
</details>

---

#### `GET` /anime/genres/{genreId}

**Данные по жанру**

Возвращает данные по жанру

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `8276762d056f3ccc731848b30a89dc7a`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `genreId` | `path`       | `object` | **Да**       | ID Жанра                                                                                                                           | `15`                   |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание        | Схема ответа                                            |
| :------ | :-------------- | :------------------------------------------------------ |
| **200** | Данные по жанру | `application/json` (responses.api.v1.anime.genres.item) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
{}
```
</details>

---

#### `GET` /anime/genres/random

**Список случайных жанров**

Возвращает список случайных жанров

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `9822b098b63cec6ffbd72c091251d9d1`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `limit`   | `query`      | `object` | Нет          | Количество жанров в выдаче                                                                                                         | `8`                    |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                | Схема ответа                                            |
| :------ | :---------------------- | :------------------------------------------------------ |
| **200** | Список доступных жанров | `application/json` (responses.api.v1.anime.genres.list) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 21,
    "name": "Комедия",
    "image": {},
    "total_releases": 10
  }
]
```
</details>

---

#### `GET` /anime/genres/{genreId}/releases

**Список релизов жанра**

Возвращает список всех релизов жанра

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `3e7da8fb153756860d8739524f021926`

##### Параметры запроса

| Имя       | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `genreId` | `path`       | `integer` | **Да**       | ID Жанра                                                                                                                           | `15`                   |
| `page`    | `query`      | `integer` | Нет          | Номер страницы                                                                                                                     | `1`                    |
| `limit`   | `query`      | `integer` | Нет          | Ограничение на количество элементов                                                                                                | `10`                   |
| `include` | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание             | Схема ответа                                                |
| :------ | :------------------- | :---------------------------------------------------------- |
| **200** | Список релизов жанра | `application/json` (responses.api.v1.anime.genres.releases) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [
    {
      "id": 7439,
      "type": null,
      "year": 2018,
      "name": null,
      "alias": "sword-art-online-alicization",
      "season": null,
      "poster": null,
      "fresh_at": "2019-12-29T23:06:39+00:00",
      "created_at": "2019-12-29T23:06:39+00:00",
      "updated_at": "2023-08-20T15:08:20+00:00",
      "is_ongoing": false,
      "age_rating": null,
      "publish_day": null,
      "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
      "notification": "Серии выходят по воскресеньям",
      "episodes_total": 36,
      "external_player": "//kodik.info/serial/...",
      "is_in_production": false,
      "is_blocked_by_geo": false,
      "is_blocked_by_copyrights": false,
      "added_in_users_favorites": 25557,
      "average_duration_of_episode": 25,
      "added_in_planned_collection": 2457,
      "added_in_watched_collection": 467,
      "added_in_watching_collection": 346,
      "added_in_postponed_collection": 212,
      "added_in_abandoned_collection": 12
    }
  ],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

---

### Аниме.Релизы

#### `GET` /anime/releases/latest

**Последние релизы**

Возвращает данные по последним релизам

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `da7be4d3e8d38a49fcf71358df5c0a76`

##### Параметры запроса

| Имя       | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `limit`   | `query`      | `integer` | Нет          | Количество последних релизов в выдаче                                                                                              | `14`                   |
| `include` | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                |
| :------ | :---------------------------------- | :---------------------------------------------------------- |
| **200** | Данные по релизам                   | `application/json` (responses.api.v1.anime.releases.latest) |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)  |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[{}]
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `GET` /anime/releases/random

**Данные по случайным релизам**

Возвращает данные по случайным релизам

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `9eb40a19816cdbb7621cb40d6c8eef3b`

##### Параметры запроса

| Имя       | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `limit`   | `query`      | `integer` | Нет          | Количество случайных релизов                                                                                                       | `5`                    |
| `include` | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание          | Схема ответа                                                |
| :------ | :---------------- | :---------------------------------------------------------- |
| **200** | Данные по релизам | `application/json` (responses.api.v1.anime.releases.random) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 7439,
    "type": {
      "value": null,
      "description": null
    },
    "year": 2018,
    "name": {
      "main": null,
      "english": null,
      "alternative": null
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": null
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": null,
      "is_adult": null,
      "description": null
    },
    "publish_day": {
      "value": null,
      "description": null
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  }
]
```
</details>

---

#### `GET` /anime/releases/recommended

**Данные по рекомендованным релизам**

Возвращает данные по рекомендованным релизам

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `990d70067d30af5eda130e840fcef7ac`

##### Параметры запроса

| Имя          | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :----------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `limit`      | `query`      | `integer` | Нет          | Количество рекомендованных релизов                                                                                                 | `5`                    |
| `release_id` | `query`      | `integer` | Нет          | Идентификатор релиза, для которого рекомендуем                                                                                     | `9246`                 |
| `include`    | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`    | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                                     |
| :------ | :---------------------------------- | :--------------------------------------------------------------- |
| **200** | Данные по релизам                   | `application/json` (responses.api.v1.anime.releases.recommended) |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content)       |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 7439,
    "type": {
      "value": null,
      "description": null
    },
    "year": 2018,
    "name": {
      "main": null,
      "english": null,
      "alternative": null
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": null
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": null,
      "is_adult": null,
      "description": null
    },
    "publish_day": {
      "value": null,
      "description": null
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  }
]
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `GET` /anime/releases/list

**Данные по списку релизов**

Возвращает данные по списку релизов

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `6efff710532e9015d91227fdb616faeb`

##### Параметры запроса

| Имя       | Расположение | Тип                | Обязательный | Описание                                                                                                                           | Пример                      |
| :-------- | :----------- | :----------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| `ids`     | `query`      | array of `integer` | Нет          | Список ID релизов                                                                                                                  | `[9951,9433,5692]`          |
| `aliases` | `query`      | array of `string`  | Нет          | Список alias релизов                                                                                                               | `["darling-in-the-franxx"]` |
| `page`    | `query`      | `integer`          | Нет          | Номер страницы                                                                                                                     | `1`                         |
| `limit`   | `query`      | `integer`          | Нет          | Ограничение на количество элементов                                                                                                | `10`                        |
| `include` | `query`      | `object`           | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`          |
| `exclude` | `query`      | `object`           | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"`      |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                               |
| :------ | :---------------------------------- | :--------------------------------------------------------- |
| **200** | Данные по релизу                    | `application/json` (responses.api.v1.anime.releases.list)  |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `GET` /anime/releases/{idOrAlias}

**Данные по релизу**

Возвращает данные по релизу

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `1a04f3ab108f6960aacb815ecabe29d2`

##### Параметры запроса

| Имя         | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :---------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `idOrAlias` | `path`       | `object` | **Да**       | id или alias релиза                                                                                                                | -                      |
| `include`   | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`   | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание         | Схема ответа                                                 |
| :------ | :--------------- | :----------------------------------------------------------- |
| **200** | Данные по релизу | `application/json` (responses.api.v1.anime.releases.release) |
| **404** | Релиз не найден  | Нет данных                                                   |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
{}
```
</details>

---

#### `GET` /anime/releases/{idOrAlias}/members

**Список участников, которые работали над релизом**

Возвращает данные по участникам релиза

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `073e49978330ed579e84cc9deb3ba3e6`

##### Параметры запроса

| Имя         | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :---------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `idOrAlias` | `path`       | `object` | **Да**       | id или alias релиза                                                                                                                | `"4754"`               |
| `include`   | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`   | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                      | Схема ответа                                                         |
| :------ | :---------------------------- | :------------------------------------------------------------------- |
| **200** | Данные по участникам в релизе | `application/json` (responses.api.v1.anime.releases.release.members) |
| **404** | Релиз не найден               | Нет данных                                                           |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": "uuid...",
    "role": {
      "value": null,
      "description": null
    },
    "user": null,
    "nickname": "Zvukar"
  }
]
```
</details>

---

#### `GET` /anime/releases/{idOrAlias}/episodes/timecodes

**Данные по таймкодам просмотра эпизодов релиза**

Возвращает данные по всем существующим таймкодам просмотра эпизодов релиза. Имеет 1-2-x минутный кэш.

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `ca61988f225283fc8a0db99f4f4cfab4`

##### Параметры запроса

| Имя         | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :---------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `idOrAlias` | `path`       | `object` | **Да**       | id или alias релиза                                                                                                                | `"4754"`               |
| `include`   | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`   | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                                          | Схема ответа                                                                    |
| :------ | :------------------------------------------------ | :------------------------------------------------------------------------------ |
| **200** | Данные по просмотру пользователем эпизодов релиза | `application/json` (responses.api.v1.anime.releases.release.episodes.timecodes) |
| **403** | Необходимо авторизоваться                         | Нет данных                                                                      |
| **404** | Релиз не найден                                   | Нет данных                                                                      |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 123,
    "time": 127.45,
    "user_id": 42,
    "is_watched": true,
    "updated_at": "2025-06-23T14:00:00+00:00",
    "release_episode_id": "9b5e26ee-598f-4b8b-b77e-188d3e456318"
  }
]
```
</details>

---

### Аниме.Релизы.Эпизоды

#### `GET` /anime/releases/episodes/{releaseEpisodeId}

**Данные по эпизоду**

Возвращает данные по эпизоду

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `d5f0cbb2ce401655a7af10ca7b50eb41`

##### Параметры запроса

| Имя                | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                                   |
| :----------------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| `releaseEpisodeId` | `path`       | `object` | **Да**       | Идентификатор эпизода                                                                                                              | `"cf31fe87-fad8-11eb-b2fa-0242ac120004"` |
| `include`          | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`                       |
| `exclude`          | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"`                   |

##### Ответы (Responses)

| Код     | Описание          | Схема ответа                                                 |
| :------ | :---------------- | :----------------------------------------------------------- |
| **200** | Данные по эпизоду | `application/json` (responses.api.v1.anime.releases.episode) |
| **404** | Эпизод не найден  | Нет данных                                                   |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
{}
```
</details>

---

#### `GET` /anime/releases/episodes/{releaseEpisodeId}/timecode

**Данные по просмотру эпизода**

Возвращает данные по просмотру указанного эпизода авторизованным пользователем. Имеет 1-2-x минутный кэш.

- **Авторизация:** 🔒 Требуется (`sessionToken`)
- **Operation ID:** `3983ade6cbabc60d428294310a365755`

##### Параметры запроса

| Имя                | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                                   |
| :----------------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| `releaseEpisodeId` | `path`       | `object` | **Да**       | Идентификатор эпизода                                                                                                              | `"cf31fe87-fad8-11eb-b2fa-0242ac120004"` |
| `include`          | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`                       |
| `exclude`          | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"`                   |

##### Ответы (Responses)

| Код     | Описание                               | Схема ответа                                                          |
| :------ | :------------------------------------- | :-------------------------------------------------------------------- |
| **200** | Данные по просмотру эпизода            | `application/json` (responses.api.v1.anime.releases.episode.timecode) |
| **403** | Необходимо авторизоваться              | Нет данных                                                            |
| **404** | Данные по просмотру эпизода не найдены | Нет данных                                                            |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
{}
```
</details>

---

### Аниме.Релизы.РасписаниеРелизов

#### `GET` /anime/schedule/now

**Данные по расписанию релизов на текущую дату**

Возвращает список релизов в расписании на текущую дату

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `2050390fd4fc22b85e05f08f5d9fdf4c`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                       | Схема ответа                                         |
| :------ | :----------------------------- | :--------------------------------------------------- |
| **200** | Данные по релизам в расписании | `application/json` (responses.v1.anime.schedule.now) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле        | Тип               | Обязательное | Описание | Пример |
| :---------- | :---------------- | :----------- | :------- | :----- |
| `today`     | array of `object` | Нет          | -        | -      |
| `tomorrow`  | array of `object` | Нет          | -        | -      |
| `yesterday` | array of `object` | Нет          | -        | -      |

```json
{
  "today": [
    {
      "release": null,
      "full_season_is_released": true,
      "published_release_episode": null,
      "next_release_episode_number": 8
    }
  ],
  "tomorrow": [
    {
      "release": null,
      "full_season_is_released": true,
      "published_release_episode": null,
      "next_release_episode_number": 8
    }
  ],
  "yesterday": [
    {
      "release": null,
      "full_season_is_released": true,
      "published_release_episode": null,
      "next_release_episode_number": 8
    }
  ]
}
```
</details>

---

#### `GET` /anime/schedule/week

**Данные по расписанию релизов на текущую неделю**

Возвращает список релизов в расписании на текущую неделю

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `210dca9590f9b5be1dbef022cdb2221d`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                       | Схема ответа                                          |
| :------ | :----------------------------- | :---------------------------------------------------- |
| **200** | Данные по релизам в расписании | `application/json` (responses.v1.anime.schedule.week) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле   | Тип               | Обязательное | Описание | Пример |
| :----- | :---------------- | :----------- | :------- | :----- |
| `data` | array of `object` | Нет          | -        | -      |

```json
{
  "data": [
    {
      "release": null,
      "full_season_is_released": true,
      "published_release_episode": null,
      "next_release_episode_number": 8
    }
  ]
}
```
</details>

---

### Аниме.Торренты

#### `GET` /anime/torrents

**Данные по торрентам**

Возвращает данные по последним торрентам

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `fcca810f1ea3f9fbd7de393b7a6ccd1b`

##### Параметры запроса

| Имя       | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `page`    | `query`      | `integer` | Нет          | Номер страницы                                                                                                                     | `1`                    |
| `limit`   | `query`      | `integer` | Нет          | Ограничение на количество элементов                                                                                                | `10`                   |
| `include` | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                            | Схема ответа                                               |
| :------ | :---------------------------------- | :--------------------------------------------------------- |
| **200** | Данные по торренту                  | `application/json` (responses.api.v1.anime.torrents)       |
| **422** | Ошибка валидации входных параметров | `application/json` (commons.v1.http.responses.422.content) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": null,
        "next": null
      }
    }
  }
}
```
</details>

<details><summary><b>Ответ 422 (application/json) — Структура и Пример</b></summary>

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

---

#### `GET` /anime/torrents/{hashOrId}

**Данные по торренту**

Возвращает данные по торренту

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `a55686f9bd5cdcaf372a85f3ec2fc65c`

##### Параметры запроса

| Имя        | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :--------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `hashOrId` | `path`       | `string` | **Да**       | Hash или ID торрента                                                                                                               | -                      |
| `include`  | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`  | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                                         | Схема ответа                                        |
| :------ | :----------------------------------------------- | :-------------------------------------------------- |
| **200** | Данные по торренту                               | `application/json` (responses.api.v1.anime.torrent) |
| **404** | Не удалось найти торрент по такому hash значению | Нет данных                                          |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
{}
```
</details>

---

#### `GET` /anime/torrents/{hashOrId}/file

**Торрент-файл по его hash или id**

Возвращает торрент-файл

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `0d2789b05c70d7a360902559c116e4b4`

##### Параметры запроса

| Имя        | Расположение | Тип      | Обязательный | Описание                                                                          | Пример |
| :--------- | :----------- | :------- | :----------- | :-------------------------------------------------------------------------------- | :----- |
| `hashOrId` | `path`       | `string` | **Да**       | Hash или ID торрента                                                              | -      |
| `pk`       | `query`      | `string` | Нет          | passkey пользователя. Оставьте пустым для собственного pk (если аутентифицирован) | -      |

##### Ответы (Responses)

| Код     | Описание                                         | Схема ответа               |
| :------ | :----------------------------------------------- | :------------------------- |
| **200** | Торрент файл                                     | `application/x-bittorrent` |
| **404** | Не удалось найти торрент по такому hash значению | Нет данных                 |

---

#### `GET` /anime/torrents/release/{releaseId}

**Данные по торрентам для релиза**

Возвращает данные по торрентам релиза

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `520cfcb16987b608d2965d42df8d3010`

##### Параметры запроса

| Имя         | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :---------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `releaseId` | `path`       | `integer` | **Да**       | ID релиза                                                                                                                          | `4754`                 |
| `include`   | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude`   | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание                          | Схема ответа                                                         |
| :------ | :-------------------------------- | :------------------------------------------------------------------- |
| **200** | Данные по торрентам               | `application/json` (responses.api.v1.anime.torrents.releaseTorrents) |
| **404** | Не удалось найти релиз с таким ID | Нет данных                                                           |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[]
```
</details>

---

#### `GET` /anime/torrents/rss

**RSS лента последних торрентов**

Возвращает данные по последним торрентам в виде XML документа

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `530df7fab8c5f401c1827acf9de7a991`

##### Параметры запроса

| Имя     | Расположение | Тип       | Обязательный | Описание                                                                          | Пример |
| :------ | :----------- | :-------- | :----------- | :-------------------------------------------------------------------------------- | :----- |
| `limit` | `query`      | `integer` | Нет          | Количество торрентов в выдаче. По умолчанию 10                                    | -      |
| `pk`    | `query`      | `string`  | Нет          | Пользовательский passkey. Персонализирует ссылки на торренты для учета статистики | -      |

##### Ответы (Responses)

| Код     | Описание     | Схема ответа      |
| :------ | :----------- | :---------------- |
| **200** | XML документ | `application/xml` |

---

#### `GET` /anime/torrents/rss/release/{releaseId}

**RSS лента торрентов релиза**

Возвращает данные по торрентам релиза в виде RSS ленты

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `b0a67aeaf4fb4d0e67b47452c1f71161`

##### Параметры запроса

| Имя         | Расположение | Тип       | Обязательный | Описание                                                                          | Пример |
| :---------- | :----------- | :-------- | :----------- | :-------------------------------------------------------------------------------- | :----- |
| `releaseId` | `path`       | `integer` | **Да**       | ID релиза                                                                         | `4754` |
| `pk`        | `query`      | `string`  | Нет          | Пользовательский passkey. Персонализирует ссылки на торренты для учета статистики | -      |

##### Ответы (Responses)

| Код     | Описание     | Схема ответа      |
| :------ | :----------- | :---------------- |
| **200** | XML документ | `application/xml` |

---

### Приложение.Поиск

#### `GET` /app/search/releases

**Поиск релизов**

Возвращает данные по релизам, которые удовлетворяют поисковому запросу

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `bdc9c56b8c4464f3629eaccabac8db20`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `query`   | `query`      | `string` | **Да**       | Поисковая строка                                                                                                                   | -                      |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание         | Схема ответа                                              |
| :------ | :--------------- | :-------------------------------------------------------- |
| **200** | Найденные релизы | `application/json` (responses.api.v1.app.search.releases) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": 7439,
    "type": {
      "value": null,
      "description": null
    },
    "year": 2018,
    "name": {
      "main": null,
      "english": null,
      "alternative": null
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": null
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": null,
      "is_adult": null,
      "description": null
    },
    "publish_day": {
      "value": null,
      "description": null
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  }
]
```
</details>

---

### Приложение.Статус

#### `GET` /app/status

**Статус API**

Возвращает информацию о статусе API

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `5523c4a4ef98641efa267e67891c7762`

##### Ответы (Responses)

| Код     | Описание       | Схема ответа                                 |
| :------ | :------------- | :------------------------------------------- |
| **200** | Успешный ответ | `application/json` (responses.v1.app.status) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле                      | Тип               | Обязательное | Описание | Пример                       |
| :------------------------ | :---------------- | :----------- | :------- | :--------------------------- |
| `request`                 | `object`          | Нет          | -        | -                            |
| `request.ip`              | `string`          | Нет          | -        | `"192.168.1.1"`              |
| `request.country`         | `string`          | Нет          | -        | `"Russia"`                   |
| `request.iso_code`        | `string`          | Нет          | -        | `"RU"`                       |
| `request.timezone`        | `string`          | Нет          | -        | `"Europe/Moscow"`            |
| `is_alive`                | `boolean`         | Нет          | -        | `true`                       |
| `available_api_endpoints` | array of `string` | Нет          | -        | `["https://aniliberty.top"]` |

```json
{
  "request": {
    "ip": "192.168.1.1",
    "country": "Russia",
    "iso_code": "RU",
    "timezone": "Europe/Moscow"
  },
  "is_alive": true,
  "available_api_endpoints": ["https://aniliberty.top"]
}
```
</details>

---

### Медиа.Промо

#### `GET` /media/promotions

**Список промо-материалов**

Возвращает список промо-материалов или рекламные кампании в случайном порядке

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `a9e450153c7cb6120c51bb4737c830f8`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание       | Схема ответа                                       |
| :------ | :------------- | :------------------------------------------------- |
| **200** | Промо-материал | `application/json` (responses.v1.media.promotions) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле   | Тип               | Обязательное | Описание | Пример |
| :----- | :---------------- | :----------- | :------- | :----- |
| `data` | array of `object` | Нет          | -        | -      |

```json
{
  "data": [
    {
      "id": "bad864a4-d1b9-473f-898f-da8ee800ef87",
      "url": "https://espritgames.ru/dragoncontract/promotions/getdragon",
      "url_label": "Перейти на сайт",
      "image": null,
      "title": "Dragon Contract",
      "description": "ИСПЫТАЙ СВОЮ ПАМЯТЬ! Собери все пары карточек правильно, и получи дракона на старте!",
      "is_ad": true,
      "ad_erid": "string",
      "ad_origin": "string",
      "release": null,
      "has_overlay": true
    }
  ]
}
```
</details>

---

### Медиа.Видеоконтент

#### `GET` /media/videos

**Список видео-роликов**

Возвращает список последних видео-роликов

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `13324a2b1d96abfe1fbb72686b164afd`

##### Параметры запроса

| Имя       | Расположение | Тип       | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :-------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `limit`   | `query`      | `integer` | Нет          | Количество роликов в выдаче                                                                                                        | `5`                    |
| `include` | `query`      | `object`  | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object`  | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание             | Схема ответа                                   |
| :------ | :------------------- | :--------------------------------------------- |
| **200** | Список видео-роликов | `application/json` (responses.v1.media.videos) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

| Поле   | Тип               | Обязательное | Описание | Пример |
| :----- | :---------------- | :----------- | :------- | :----- |
| `data` | array of `object` | Нет          | -        | -      |

```json
{
  "data": [{}]
}
```
</details>

---

### Команды

#### `GET` /teams/

**Список команд АниЛибрии**

Возвращает список всех команд

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `b8116e18f2ffc250bda35faa120bbe2d`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание | Схема ответа                                |
| :------ | :------- | :------------------------------------------ |
| **200** | Команды  | `application/json` (responses.api.v1.teams) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": "string",
    "title": "string",
    "sort_order": 0,
    "description": "string"
  }
]
```
</details>

---

#### `GET` /teams/roles

**Список ролей**

Возвращает список всех ролей в командах

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `a9c6af5eb738ffb0b0ffe2827ab8a66a`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание        | Схема ответа                                      |
| :------ | :-------------- | :------------------------------------------------ |
| **200** | Роли в командах | `application/json` (responses.api.v1.teams.roles) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[
  {
    "id": "string",
    "title": "string",
    "color": "string",
    "sort_order": 0
  }
]
```
</details>

---

#### `GET` /teams/users

**Список анилибрийцов**

Возвращает список всех анилибрийцов с указанием команды и своих ролей

- **Авторизация:** 🔓 Не требуется (публичный)
- **Operation ID:** `7595de64ca791916074cb8c193a21604`

##### Параметры запроса

| Имя       | Расположение | Тип      | Обязательный | Описание                                                                                                                           | Пример                 |
| :-------- | :----------- | :------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| `include` | `query`      | `object` | Нет          | Список включаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку.                        | `"id,type.genres"`     |
| `exclude` | `query`      | `object` | Нет          | Список исключаемых полей. Через запятую или множественные параметры. Поддерживается вложенность через точку. Приоритет над include | `"poster,description"` |

##### Ответы (Responses)

| Код     | Описание    | Схема ответа                                      |
| :------ | :---------- | :------------------------------------------------ |
| **200** | Анилибрийцы | `application/json` (responses.api.v1.teams.users) |

<details><summary><b>Ответ 200 (application/json) — Структура и Пример</b></summary>

```json
[]
```
</details>

---

## Модели данных (Схемы)

Ниже приведены описания и структуры моделей данных (DTO) API AniLiberty.

### `commons.v1.http.responses.422.content`

_Ошибка валидации  параметров_

- **Тип:** `object`

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `errors` | `object` | Нет          | -        | -      |

<details><summary>Пример объекта</summary>

```json
{
  "errors": {
    "parameter1": [
      "Поле parameter1 обязательно для заполнения",
      "Поле parameter1 должно быть числом"
    ],
    "parameter2": ["Поле parameter2 должно быть строкой"]
  }
}
```
</details>

### `commons.v1.models.components.image`

- **Тип:** `object`

| Поле        | Тип      | Обязательное | Описание              | Пример                                       |
| :---------- | :------- | :----------- | :-------------------- | :------------------------------------------- |
| `preview`   | `string` | Нет          | Ссылка на изображение | `"/...GoH5bzLFS7A21DzacgUApScj7qJY1iMz.(jpg  | webp)"` |
| `thumbnail` | `string` | Нет          | Ссылка на изображение | `"/.../GoH5bzLFS7A21DzacgUApScj7qJY1iMz.(jpg | webp)"` |

<details><summary>Пример объекта</summary>

```json
{
  "preview": "/...GoH5bzLFS7A21DzacgUApScj7qJY1iMz.(jpg|webp)",
  "thumbnail": "/.../GoH5bzLFS7A21DzacgUApScj7qJY1iMz.(jpg|webp)"
}
```
</details>

### `commons.v1.models.components.image.withOptimized`

- **Тип:** `object`

### `commons.v1.utils.pagination.schemes.meta`

- **Тип:** `object`

| Поле                        | Тип       | Обязательное | Описание | Пример                                   |
| :-------------------------- | :-------- | :----------- | :------- | :--------------------------------------- |
| `pagination`                | `object`  | Нет          | -        | -                                        |
| `pagination.total`          | `integer` | Нет          | -        | `"1704"`                                 |
| `pagination.count`          | `integer` | Нет          | -        | `"10"`                                   |
| `pagination.per_page`       | `integer` | Нет          | -        | `"10"`                                   |
| `pagination.current_page`   | `integer` | Нет          | -        | `"5"`                                    |
| `pagination.total_pages`    | `integer` | Нет          | -        | `"171"`                                  |
| `pagination.links`          | `object`  | Нет          | -        | -                                        |
| `pagination.links.previous` | `string`  | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `pagination.links.next`     | `string`  | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "pagination": {
    "total": "1704",
    "count": "10",
    "per_page": "10",
    "current_page": "5",
    "total_pages": "171",
    "links": {
      "previous": "/api/version/path-to-resource?page=1",
      "next": "/api/version/path-to-resource?page=3"
    }
  }
}
```
</details>

### `enums.accounts.users.user.collection.type`

_Тип коллекции_

- **Тип:** `string`

### `enums.accounts.users.user.favorite.filter.sorting`

- **Тип:** `string`

### `enums.accounts.users.user.social.type`

- **Тип:** `string`

### `enums.ads.banner.placement`

_Позиции размещения рекламных баннеров_

- **Тип:** `string`

### `enums.ads.statistics.event.type`

_Типы событий рекламной статистики_

- **Тип:** `string`

### `enums.anime.catalog.filter.productionStatus`

- **Тип:** `string`

### `enums.anime.catalog.filter.publishStatus`

- **Тип:** `string`

### `enums.anime.catalog.filter.sorting`

- **Тип:** `string`

### `enums.anime.releases.release.ageRating`

- **Тип:** `string`

### `enums.anime.releases.release.member.role`

_Роль участника релиза_

- **Тип:** `string`

### `enums.anime.releases.release.publishDay`

- **Тип:** `integer`

### `enums.anime.releases.release.season`

- **Тип:** `string`

### `enums.anime.releases.release.type`

- **Тип:** `string`

### `enums.anime.torrents.torrent.codec`

_Список возможных значений кодека видеодорожки в торренте_

- **Тип:** `string`

### `enums.anime.torrents.torrent.color`

_Список возможных значений глубины цвета видеодорожки_

- **Тип:** `string`

### `enums.anime.torrents.torrent.quality`

_Список возможных значений качества видео в торренте_

- **Тип:** `string`

### `enums.anime.torrents.torrent.type`

_Список возможных значений источника видео (тип релиза)_

- **Тип:** `string`

### `enums.anime.torrents.torrentMember.role`

_Список ролей участников торрента_

- **Тип:** `string`

### `enums.media.videos.video.origin.type`

_Перечисление типов источников видео_

- **Тип:** `string`

### `models.accounts.otp.v1.otp`

_Данные по OTP коду_

- **Тип:** `object`

| Поле         | Тип                  | Обязательное | Описание           | Пример                                   |
| :----------- | :------------------- | :----------- | :----------------- | :--------------------------------------- |
| `code`       | `string`             | Нет          | -                  | `"058701"`                               |
| `user_id`    | `integer`            | Нет          | -                  | `1337`                                   |
| `device_id`  | `string`             | Нет          | -                  | `"n702175b-fa52-5251-a39z-d1f4af0w1cak"` |
| `expired_at` | `string (date-time)` | Нет          | Срок действия кода | `"2021-09-28T19:40:26+00:00"`            |

<details><summary>Пример объекта</summary>

```json
{
  "code": "058701",
  "user_id": 1337,
  "device_id": "n702175b-fa52-5251-a39z-d1f4af0w1cak",
  "expired_at": "2021-09-28T19:40:26+00:00"
}
```
</details>

### `models.accounts.users.v1.user.view`

- **Тип:** `object`

| Поле                 | Тип                  | Обязательное | Описание                                        | Пример                                   |
| :------------------- | :------------------- | :----------- | :---------------------------------------------- | :--------------------------------------- |
| `id`                 | `integer`            | Нет          | ID записи просмотра                             | `123`                                    |
| `time`               | `integer (float)`    | Нет          | Таймкод просмотра, в секундах от начала эпизода | `127.45`                                 |
| `user_id`            | `integer`            | Нет          | ID пользователя                                 | `42`                                     |
| `is_watched`         | `boolean`            | Нет          | Флаг, просмотрен ли эпизод полностью            | `true`                                   |
| `updated_at`         | `string (date-time)` | Нет          | Дата обновления записи                          | `"2025-06-23T14:00:00+00:00"`            |
| `release_episode_id` | `string`             | Нет          | ID эпизода релиза                               | `"9b5e26ee-598f-4b8b-b77e-188d3e456318"` |

<details><summary>Пример объекта</summary>

```json
{
  "id": 123,
  "time": 127.45,
  "user_id": 42,
  "is_watched": true,
  "updated_at": "2025-06-23T14:00:00+00:00",
  "release_episode_id": "9b5e26ee-598f-4b8b-b77e-188d3e456318"
}
```
</details>

### `models.ads.banners.v1.banner`

_Данные рекламного баннера_

- **Тип:** `object`

| Поле              | Тип                                          | Обязательное | Описание                              | Пример                                     |
| :---------------- | :------------------------------------------- | :----------- | :------------------------------------ | :----------------------------------------- |
| `id`              | `integer`                                    | Нет          | -                                     | `101`                                      |
| `title`           | `string`                                     | Нет          | -                                     | `"Смотри аниме без рекламы!"`              |
| `image`           | `object`                                     | Нет          | -                                     | -                                          |
| `ad_erid`         | `string`                                     | Нет          | -                                     | `"CZkqkNu5u8N"`                            |
| `image_url`       | `string`                                     | Нет          | -                                     | `"https://external.site/banner.jpg"`       |
| `button_url`      | `string`                                     | Нет          | -                                     | `"https://aniliberty.top/subscribe"`       |
| `placement`       | `string ["HOME_SUPPORT", "RELEASE_SIDEBAR"]` | Нет          | Позиции размещения рекламных баннеров | -                                          |
| `has_overlay`     | `boolean`                                    | Нет          | -                                     | `true`                                     |
| `button_title`    | `string`                                     | Нет          | -                                     | `"Подписаться"`                            |
| `description`     | `string`                                     | Нет          | -                                     | `"Смотри любимые сериалы без ограничений"` |
| `ad_company_itn`  | `string`                                     | Нет          | -                                     | `"7707083893"`                             |
| `ad_company_name` | `string`                                     | Нет          | -                                     | `"ООО \"Аниме Медиа Групп\""`              |

<details><summary>Пример объекта</summary>

```json
{
  "id": 101,
  "title": "Смотри аниме без рекламы!",
  "image": {},
  "ad_erid": "CZkqkNu5u8N",
  "image_url": "https://external.site/banner.jpg",
  "button_url": "https://aniliberty.top/subscribe",
  "placement": "HOME_SUPPORT",
  "has_overlay": true,
  "button_title": "Подписаться",
  "description": "Смотри любимые сериалы без ограничений",
  "ad_company_itn": "7707083893",
  "ad_company_name": "ООО \"Аниме Медиа Групп\""
}
```
</details>

### `models.ads.vasts.v1.vast`

_Данные по рекламе VAST_

- **Тип:** `object`

| Поле              | Тип      | Обязательное | Описание | Пример                                   |
| :---------------- | :------- | :----------- | :------- | :--------------------------------------- |
| `id`              | `string` | Нет          | -        | `"17974e6e-da62-427b-9937-9021cf4cafe4"` |
| `url`             | `string` | Нет          | -        | `"https://example.com/vast.xml"`         |
| `ad_erid`         | `string` | Нет          | -        | `"ERID123456789"`                        |
| `ad_company_itn`  | `string` | Нет          | -        | `"1234567890"`                           |
| `ad_company_name` | `string` | Нет          | -        | `"Company XYZ"`                          |

<details><summary>Пример объекта</summary>

```json
{
  "id": "17974e6e-da62-427b-9937-9021cf4cafe4",
  "url": "https://example.com/vast.xml",
  "ad_erid": "ERID123456789",
  "ad_company_itn": "1234567890",
  "ad_company_name": "Company XYZ"
}
```
</details>

### `models.anime.franchises.v1.franchise`

_Данные по франшизе_

- **Тип:** `object`

| Поле                        | Тип       | Обязательное | Описание                               | Пример                                     |
| :-------------------------- | :-------- | :----------- | :------------------------------------- | :----------------------------------------- |
| `id`                        | `string`  | Нет          | Идентификатор франшизы                 | `"116e17d2-e89f-4ffc-bfa4-b45ae4c41e92"`   |
| `name`                      | `string`  | Нет          | Название франшизы (на русском)         | `"Re: Жизнь в другом мире с нуля"`         |
| `name_english`              | `string`  | Нет          | Название франшизы (на английском)      | `"Re: Zero kara Hajimeru Isekai Seikatsu"` |
| `image`                     | `object`  | Нет          | -                                      | -                                          |
| `rating`                    | `number`  | Нет          | Рейтинг франшизы                       | `8.45`                                     |
| `last_year`                 | `integer` | Нет          | Год последнего релиза                  | `2023`                                     |
| `first_year`                | `integer` | Нет          | Год первого релиза                     | `2010`                                     |
| `total_releases`            | `integer` | Нет          | Количество релизов                     | `10`                                       |
| `total_episodes`            | `integer` | Нет          | Общее количество эпизодов              | `25`                                       |
| `total_duration`            | `string`  | Нет          | Общая длительность франшизы            | `"2 дня 5 часов"`                          |
| `total_duration_in_seconds` | `integer` | Нет          | Общая длительность франшизы в секундах | `183600`                                   |

<details><summary>Пример объекта</summary>

```json
{
  "id": "116e17d2-e89f-4ffc-bfa4-b45ae4c41e92",
  "name": "Re: Жизнь в другом мире с нуля",
  "name_english": "Re: Zero kara Hajimeru Isekai Seikatsu",
  "image": {},
  "rating": 8.45,
  "last_year": 2023,
  "first_year": 2010,
  "total_releases": 10,
  "total_episodes": 25,
  "total_duration": "2 дня 5 часов",
  "total_duration_in_seconds": 183600
}
```
</details>

### `models.anime.franchises.v1.franchise.release`

_Данные по релизам в франшизе_

- **Тип:** `object`

| Поле           | Тип       | Обязательное | Описание                   | Пример                                   |
| :------------- | :-------- | :----------- | :------------------------- | :--------------------------------------- |
| `id`           | `string`  | Нет          | ID связки релиз — франшиза | `"db1ebabd-b4b8-4391-85f3-79294515641a"` |
| `sort_order`   | `integer` | Нет          | Порядок сортировки         | `2`                                      |
| `release_id`   | `integer` | Нет          | Идентификатор релиза       | `9045`                                   |
| `franchise_id` | `string`  | Нет          | Идентификатор франшизы     | `"3f69ea9b-c202-4522-96b9-07a5de8aa963"` |

<details><summary>Пример объекта</summary>

```json
{
  "id": "db1ebabd-b4b8-4391-85f3-79294515641a",
  "sort_order": 2,
  "release_id": 9045,
  "franchise_id": "3f69ea9b-c202-4522-96b9-07a5de8aa963"
}
```
</details>

### `models.anime.genres.v1.genre`

_Данные по жанрам_

- **Тип:** `object`

| Поле             | Тип       | Обязательное | Описание                              | Пример      |
| :--------------- | :-------- | :----------- | :------------------------------------ | :---------- |
| `id`             | `integer` | Нет          | -                                     | `21`        |
| `name`           | `string`  | Нет          | -                                     | `"Комедия"` |
| `image`          | `object`  | Нет          | -                                     | -           |
| `total_releases` | `integer` | Нет          | Общее количество релизов в этом жанре | `10`        |

<details><summary>Пример объекта</summary>

```json
{
  "id": 21,
  "name": "Комедия",
  "image": {},
  "total_releases": 10
}
```
</details>

### `models.anime.releases.v1.release`

_Данные по релизу_

- **Тип:** `object`

| Поле                            | Тип                                                                       | Обязательное | Описание                                            | Пример                                                             |
| :------------------------------ | :------------------------------------------------------------------------ | :----------- | :-------------------------------------------------- | :----------------------------------------------------------------- |
| `id`                            | `number`                                                                  | Нет          | Идентификатор релиза                                | `7439`                                                             |
| `type`                          | `object`                                                                  | Нет          | Тип релиза                                          | -                                                                  |
| `type.value`                    | `string ["TV", "ONA", "WEB", "OVA", "OAD", "MOVIE", "DORAMA", "SPECIAL"]` | Нет          | -                                                   | -                                                                  |
| `type.description`              | `string`                                                                  | Нет          | -                                                   | `"ТВ"`                                                             |
| `year`                          | `number`                                                                  | Нет          | Год                                                 | `2018`                                                             |
| `name`                          | `object`                                                                  | Нет          | Название релиза                                     | -                                                                  |
| `name.main`                     | `string`                                                                  | Нет          | -                                                   | `"Мастера Меча Онлайн: Алисизация"`                                |
| `name.english`                  | `string`                                                                  | Нет          | -                                                   | `"Sword Art Online: Alicization"`                                  |
| `name.alternative`              | `string`                                                                  | Нет          | -                                                   | `"Война в Андерворлде, War of Underworld"`                         |
| `alias`                         | `string`                                                                  | Нет          | Ссылка на релиз                                     | `"sword-art-online-alicization"`                                   |
| `season`                        | `object`                                                                  | Нет          | Сезон релиза                                        | -                                                                  |
| `season.value`                  | `string ["winter", "spring", "summer", "autumn"]`                         | Нет          | -                                                   | -                                                                  |
| `season.description`            | `string`                                                                  | Нет          | -                                                   | `"Осень"`                                                          |
| `poster`                        | `object`                                                                  | Нет          | -                                                   | -                                                                  |
| `fresh_at`                      | `string (date-time)`                                                      | Нет          | Дата поднятия релиза                                | `"2019-12-29T23:06:39+00:00"`                                      |
| `created_at`                    | `string (date-time)`                                                      | Нет          | Дата создания релиза                                | `"2019-12-29T23:06:39+00:00"`                                      |
| `updated_at`                    | `string (date-time)`                                                      | Нет          | Дата обновления релиза                              | `"2023-08-20T15:08:20+00:00"`                                      |
| `is_ongoing`                    | `boolean`                                                                 | Нет          | Релиз в данный момент выходит в стране производства | `false`                                                            |
| `age_rating`                    | `object`                                                                  | Нет          | Возрастное ограничение                              | -                                                                  |
| `age_rating.value`              | `string ["R0_PLUS", "R6_PLUS", "R12_PLUS", "R16_PLUS", "R18_PLUS"]`       | Нет          | -                                                   | -                                                                  |
| `age_rating.label`              | `string`                                                                  | Нет          | -                                                   | `"16+"`                                                            |
| `age_rating.is_adult`           | `boolean`                                                                 | Нет          | -                                                   | `false`                                                            |
| `age_rating.description`        | `string`                                                                  | Нет          | -                                                   | `"Для людей, достигших возраста шестнадцати лет (16+)"`            |
| `publish_day`                   | `object`                                                                  | Нет          | День выхода релиза                                  | -                                                                  |
| `publish_day.value`             | `integer ["1", "2", "3", "4", "5", "6", "7"]`                             | Нет          | -                                                   | -                                                                  |
| `publish_day.description`       | `string`                                                                  | Нет          | -                                                   | `"Воскресенье"`                                                    |
| `description`                   | `string`                                                                  | Нет          | Описание релиза                                     | `"Underworld - мир, ранее недоступный человеческому пониманию..."` |
| `notification`                  | `string`                                                                  | Нет          | Важная информация / Оповещение                      | `"Серии выходят по воскресеньям"`                                  |
| `episodes_total`                | `number`                                                                  | Нет          | Всего эпизодов                                      | `36`                                                               |
| `external_player`               | `string`                                                                  | Нет          | Ссылка на внешний плеер                             | `"//kodik.info/serial/..."`                                        |
| `is_in_production`              | `boolean`                                                                 | Нет          | Релиз в работе / озвучивается                       | `false`                                                            |
| `is_blocked_by_geo`             | `boolean`                                                                 | Нет          | Блокировка по геолокации                            | `false`                                                            |
| `is_blocked_by_copyrights`      | `boolean`                                                                 | Нет          | Релиз заблокирован правообладателем                 | `false`                                                            |
| `added_in_users_favorites`      | `number`                                                                  | Нет          | Рейтинг по добавлению в коллекцию                   | `25557`                                                            |
| `average_duration_of_episode`   | `number`                                                                  | Нет          | Средняя продолжительность серий                     | `25`                                                               |
| `added_in_planned_collection`   | `number`                                                                  | Нет          | Кол-во добавлений в PLANNED коллекцию               | `2457`                                                             |
| `added_in_watched_collection`   | `number`                                                                  | Нет          | Кол-во добавлений в WATCHED коллекцию               | `467`                                                              |
| `added_in_watching_collection`  | `number`                                                                  | Нет          | Кол-во добавлений в WATCHING коллекцию              | `346`                                                              |
| `added_in_postponed_collection` | `number`                                                                  | Нет          | Кол-во добавлений в POSTPONED коллекцию             | `212`                                                              |
| `added_in_abandoned_collection` | `number`                                                                  | Нет          | Кол-во добавлений в ABANDONED коллекцию             | `12`                                                               |

<details><summary>Пример объекта</summary>

```json
{
  "id": 7439,
  "type": {
    "value": "TV",
    "description": "ТВ"
  },
  "year": 2018,
  "name": {
    "main": "Мастера Меча Онлайн: Алисизация",
    "english": "Sword Art Online: Alicization",
    "alternative": "Война в Андерворлде, War of Underworld"
  },
  "alias": "sword-art-online-alicization",
  "season": {
    "value": "winter",
    "description": "Осень"
  },
  "poster": {},
  "fresh_at": "2019-12-29T23:06:39+00:00",
  "created_at": "2019-12-29T23:06:39+00:00",
  "updated_at": "2023-08-20T15:08:20+00:00",
  "is_ongoing": false,
  "age_rating": {
    "value": "R0_PLUS",
    "label": "16+",
    "is_adult": false,
    "description": "Для людей, достигших возраста шестнадцати лет (16+)"
  },
  "publish_day": {
    "value": 0,
    "description": "Воскресенье"
  },
  "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
  "notification": "Серии выходят по воскресеньям",
  "episodes_total": 36,
  "external_player": "//kodik.info/serial/...",
  "is_in_production": false,
  "is_blocked_by_geo": false,
  "is_blocked_by_copyrights": false,
  "added_in_users_favorites": 25557,
  "average_duration_of_episode": 25,
  "added_in_planned_collection": 2457,
  "added_in_watched_collection": 467,
  "added_in_watching_collection": 346,
  "added_in_postponed_collection": 212,
  "added_in_abandoned_collection": 12
}
```
</details>

### `models.anime.releases.v1.release.ageRating`

_Возрастное ограничение_

- **Тип:** `object`

| Поле          | Тип                                                                 | Обязательное | Описание | Пример                                                  |
| :------------ | :------------------------------------------------------------------ | :----------- | :------- | :------------------------------------------------------ |
| `value`       | `string ["R0_PLUS", "R6_PLUS", "R12_PLUS", "R16_PLUS", "R18_PLUS"]` | Нет          | -        | -                                                       |
| `label`       | `string`                                                            | Нет          | -        | `"16+"`                                                 |
| `is_adult`    | `boolean`                                                           | Нет          | -        | `false`                                                 |
| `description` | `string`                                                            | Нет          | -        | `"Для людей, достигших возраста шестнадцати лет (16+)"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "R0_PLUS",
  "label": "16+",
  "is_adult": false,
  "description": "Для людей, достигших возраста шестнадцати лет (16+)"
}
```
</details>

### `models.anime.releases.v1.release.episode`

_Эпизод релиза_

- **Тип:** `object`

| Поле            | Тип                  | Обязательное | Описание                                                                  | Пример                                   |
| :-------------- | :------------------- | :----------- | :------------------------------------------------------------------------ | :--------------------------------------- |
| `id`            | `string`             | Нет          | Идентификатор эпизода                                                     | `"9b5e26ee-598f-4b8b-b77e-188d3e456318"` |
| `name`          | `string`             | Нет          | Название эпизода                                                          | `"Пролог"`                               |
| `ordinal`       | `number`             | Нет          | Номер эпизода. Может быть целым или дробным числом (например, 5 или 23.5) | `12.5`                                   |
| `ending`        | `object`             | Нет          | Тайминги пропуска опенинга или эндинга                                    | -                                        |
| `ending.start`  | `number`             | Нет          | Время начала. Количество секунд от начала или конца эпизода               | `6`                                      |
| `ending.stop`   | `number`             | Нет          | Время окончания. Количество секунд от начала или конца эпизода            | `125`                                    |
| `opening`       | `object`             | Нет          | Тайминги пропуска опенинга или эндинга                                    | -                                        |
| `opening.start` | `number`             | Нет          | Время начала. Количество секунд от начала или конца эпизода               | `6`                                      |
| `opening.stop`  | `number`             | Нет          | Время окончания. Количество секунд от начала или конца эпизода            | `125`                                    |
| `preview`       | `object`             | Нет          | -                                                                         | -                                        |
| `hls_480`       | `string`             | Нет          | Ссылка на поток 480p                                                      | -                                        |
| `hls_720`       | `string`             | Нет          | Ссылка на поток 720p                                                      | -                                        |
| `hls_1080`      | `string`             | Нет          | Ссылка на поток 1080p                                                     | -                                        |
| `duration`      | `number`             | Нет          | Длительность эпизода в секундах                                           | `1432`                                   |
| `rutube_id`     | `string`             | Нет          | Id эпизода на Rutube                                                      | `"c6cc4d620b1d4338901770a44b3e82f4"`     |
| `youtube_id`    | `string`             | Нет          | Id эпизода на Youtube                                                     | `"dQw4w9WgXcQ"`                          |
| `updated_at`    | `string (date-time)` | Нет          | Дата обновления эпизода                                                   | `"2021-11-25T18:46:30+00:00"`            |
| `sort_order`    | `number`             | Нет          | Порядковый номер эпизода для сортировки                                   | `12`                                     |
| `release_id`    | `number`             | Нет          | Идентификатор релиза                                                      | `9324`                                   |
| `name_english`  | `string`             | Нет          | Название эпизода на английском                                            | `"Prologue"`                             |

<details><summary>Пример объекта</summary>

```json
{
  "id": "9b5e26ee-598f-4b8b-b77e-188d3e456318",
  "name": "Пролог",
  "ordinal": 12.5,
  "ending": {
    "start": 6,
    "stop": 125
  },
  "opening": {
    "start": 6,
    "stop": 125
  },
  "preview": {},
  "hls_480": "string",
  "hls_720": "string",
  "hls_1080": "string",
  "duration": 1432,
  "rutube_id": "c6cc4d620b1d4338901770a44b3e82f4",
  "youtube_id": "dQw4w9WgXcQ",
  "updated_at": "2021-11-25T18:46:30+00:00",
  "sort_order": 12,
  "release_id": 9324,
  "name_english": "Prologue"
}
```
</details>

### `models.anime.releases.v1.release.episode.skip`

_Тайминги пропуска опенинга или эндинга_

- **Тип:** `object`

| Поле    | Тип      | Обязательное | Описание                                                       | Пример |
| :------ | :------- | :----------- | :------------------------------------------------------------- | :----- |
| `start` | `number` | Нет          | Время начала. Количество секунд от начала или конца эпизода    | `6`    |
| `stop`  | `number` | Нет          | Время окончания. Количество секунд от начала или конца эпизода | `125`  |

<details><summary>Пример объекта</summary>

```json
{
  "start": 6,
  "stop": 125
}
```
</details>

### `models.anime.releases.v1.release.member`

_Участник релиза_

- **Тип:** `object`

| Поле               | Тип                                                                                      | Обязательное | Описание                                   | Пример      |
| :----------------- | :--------------------------------------------------------------------------------------- | :----------- | :----------------------------------------- | :---------- |
| `id`               | `string`                                                                                 | Нет          | -                                          | `"uuid..."` |
| `role`             | `object`                                                                                 | Нет          | Роль участника релиза                      | -           |
| `role.value`       | `string ["poster", "timing", "voicing", "editing", "decorating", "translating", "hevc"]` | Нет          | Роль участника релиза                      | -           |
| `role.description` | `string`                                                                                 | Нет          | -                                          | `"Озвучка"` |
| `user`             | `object`                                                                                 | Нет          | Связанный с участником релиза пользователь | -           |
| `nickname`         | `string`                                                                                 | Нет          | -                                          | `"Zvukar"`  |

<details><summary>Пример объекта</summary>

```json
{
  "id": "uuid...",
  "role": {
    "value": "poster",
    "description": "Озвучка"
  },
  "user": null,
  "nickname": "Zvukar"
}
```
</details>

### `models.anime.releases.v1.release.member.role`

_Роль участника релиза_

- **Тип:** `object`

| Поле          | Тип                                                                                      | Обязательное | Описание              | Пример      |
| :------------ | :--------------------------------------------------------------------------------------- | :----------- | :-------------------- | :---------- |
| `value`       | `string ["poster", "timing", "voicing", "editing", "decorating", "translating", "hevc"]` | Нет          | Роль участника релиза | -           |
| `description` | `string`                                                                                 | Нет          | -                     | `"Озвучка"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "poster",
  "description": "Озвучка"
}
```
</details>

### `models.anime.releases.v1.release.member.user`

_Краткая информация о пользователе_

- **Тип:** `object`

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `id`     | `number` | Нет          | -        | `2346` |
| `avatar` | `object` | Нет          | -        | -      |

<details><summary>Пример объекта</summary>

```json
{
  "id": 2346,
  "avatar": {}
}
```
</details>

### `models.anime.releases.v1.release.name`

_Название релиза_

- **Тип:** `object`

| Поле          | Тип      | Обязательное | Описание | Пример                                     |
| :------------ | :------- | :----------- | :------- | :----------------------------------------- |
| `main`        | `string` | Нет          | -        | `"Мастера Меча Онлайн: Алисизация"`        |
| `english`     | `string` | Нет          | -        | `"Sword Art Online: Alicization"`          |
| `alternative` | `string` | Нет          | -        | `"Война в Андерворлде, War of Underworld"` |

<details><summary>Пример объекта</summary>

```json
{
  "main": "Мастера Меча Онлайн: Алисизация",
  "english": "Sword Art Online: Alicization",
  "alternative": "Война в Андерворлде, War of Underworld"
}
```
</details>

### `models.anime.releases.v1.release.publishDay`

_День выхода релиза_

- **Тип:** `object`

| Поле          | Тип                                           | Обязательное | Описание | Пример          |
| :------------ | :-------------------------------------------- | :----------- | :------- | :-------------- |
| `value`       | `integer ["1", "2", "3", "4", "5", "6", "7"]` | Нет          | -        | -               |
| `description` | `string`                                      | Нет          | -        | `"Воскресенье"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": 0,
  "description": "Воскресенье"
}
```
</details>

### `models.anime.releases.v1.release.season`

_Сезон релиза_

- **Тип:** `object`

| Поле          | Тип                                               | Обязательное | Описание | Пример    |
| :------------ | :------------------------------------------------ | :----------- | :------- | :-------- |
| `value`       | `string ["winter", "spring", "summer", "autumn"]` | Нет          | -        | -         |
| `description` | `string`                                          | Нет          | -        | `"Осень"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "winter",
  "description": "Осень"
}
```
</details>

### `models.anime.releases.v1.release.type`

_Тип релиза_

- **Тип:** `object`

| Поле          | Тип                                                                       | Обязательное | Описание | Пример |
| :------------ | :------------------------------------------------------------------------ | :----------- | :------- | :----- |
| `value`       | `string ["TV", "ONA", "WEB", "OVA", "OAD", "MOVIE", "DORAMA", "SPECIAL"]` | Нет          | -        | -      |
| `description` | `string`                                                                  | Нет          | -        | `"ТВ"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "TV",
  "description": "ТВ"
}
```
</details>

### `models.anime.schedule.v1.releaseInSchedule`

_Данные по релизу в расписании_

- **Тип:** `object`

| Поле                                      | Тип                                                                       | Обязательное | Описание                                                                  | Пример                                                             |
| :---------------------------------------- | :------------------------------------------------------------------------ | :----------- | :------------------------------------------------------------------------ | :----------------------------------------------------------------- |
| `release`                                 | `object`                                                                  | Нет          | Данные по релизу                                                          | -                                                                  |
| `release.id`                              | `number`                                                                  | Нет          | Идентификатор релиза                                                      | `7439`                                                             |
| `release.type`                            | `object`                                                                  | Нет          | Тип релиза                                                                | -                                                                  |
| `release.type.value`                      | `string ["TV", "ONA", "WEB", "OVA", "OAD", "MOVIE", "DORAMA", "SPECIAL"]` | Нет          | -                                                                         | -                                                                  |
| `release.type.description`                | `string`                                                                  | Нет          | -                                                                         | `"ТВ"`                                                             |
| `release.year`                            | `number`                                                                  | Нет          | Год                                                                       | `2018`                                                             |
| `release.name`                            | `object`                                                                  | Нет          | Название релиза                                                           | -                                                                  |
| `release.name.main`                       | `string`                                                                  | Нет          | -                                                                         | `"Мастера Меча Онлайн: Алисизация"`                                |
| `release.name.english`                    | `string`                                                                  | Нет          | -                                                                         | `"Sword Art Online: Alicization"`                                  |
| `release.name.alternative`                | `string`                                                                  | Нет          | -                                                                         | `"Война в Андерворлде, War of Underworld"`                         |
| `release.alias`                           | `string`                                                                  | Нет          | Ссылка на релиз                                                           | `"sword-art-online-alicization"`                                   |
| `release.season`                          | `object`                                                                  | Нет          | Сезон релиза                                                              | -                                                                  |
| `release.season.value`                    | `string ["winter", "spring", "summer", "autumn"]`                         | Нет          | -                                                                         | -                                                                  |
| `release.season.description`              | `string`                                                                  | Нет          | -                                                                         | `"Осень"`                                                          |
| `release.poster`                          | `object`                                                                  | Нет          | -                                                                         | -                                                                  |
| `release.fresh_at`                        | `string (date-time)`                                                      | Нет          | Дата поднятия релиза                                                      | `"2019-12-29T23:06:39+00:00"`                                      |
| `release.created_at`                      | `string (date-time)`                                                      | Нет          | Дата создания релиза                                                      | `"2019-12-29T23:06:39+00:00"`                                      |
| `release.updated_at`                      | `string (date-time)`                                                      | Нет          | Дата обновления релиза                                                    | `"2023-08-20T15:08:20+00:00"`                                      |
| `release.is_ongoing`                      | `boolean`                                                                 | Нет          | Релиз в данный момент выходит в стране производства                       | `false`                                                            |
| `release.age_rating`                      | `object`                                                                  | Нет          | Возрастное ограничение                                                    | -                                                                  |
| `release.age_rating.value`                | `string ["R0_PLUS", "R6_PLUS", "R12_PLUS", "R16_PLUS", "R18_PLUS"]`       | Нет          | -                                                                         | -                                                                  |
| `release.age_rating.label`                | `string`                                                                  | Нет          | -                                                                         | `"16+"`                                                            |
| `release.age_rating.is_adult`             | `boolean`                                                                 | Нет          | -                                                                         | `false`                                                            |
| `release.age_rating.description`          | `string`                                                                  | Нет          | -                                                                         | `"Для людей, достигших возраста шестнадцати лет (16+)"`            |
| `release.publish_day`                     | `object`                                                                  | Нет          | День выхода релиза                                                        | -                                                                  |
| `release.publish_day.value`               | `integer ["1", "2", "3", "4", "5", "6", "7"]`                             | Нет          | -                                                                         | -                                                                  |
| `release.publish_day.description`         | `string`                                                                  | Нет          | -                                                                         | `"Воскресенье"`                                                    |
| `release.description`                     | `string`                                                                  | Нет          | Описание релиза                                                           | `"Underworld - мир, ранее недоступный человеческому пониманию..."` |
| `release.notification`                    | `string`                                                                  | Нет          | Важная информация / Оповещение                                            | `"Серии выходят по воскресеньям"`                                  |
| `release.episodes_total`                  | `number`                                                                  | Нет          | Всего эпизодов                                                            | `36`                                                               |
| `release.external_player`                 | `string`                                                                  | Нет          | Ссылка на внешний плеер                                                   | `"//kodik.info/serial/..."`                                        |
| `release.is_in_production`                | `boolean`                                                                 | Нет          | Релиз в работе / озвучивается                                             | `false`                                                            |
| `release.is_blocked_by_geo`               | `boolean`                                                                 | Нет          | Блокировка по геолокации                                                  | `false`                                                            |
| `release.is_blocked_by_copyrights`        | `boolean`                                                                 | Нет          | Релиз заблокирован правообладателем                                       | `false`                                                            |
| `release.added_in_users_favorites`        | `number`                                                                  | Нет          | Рейтинг по добавлению в коллекцию                                         | `25557`                                                            |
| `release.average_duration_of_episode`     | `number`                                                                  | Нет          | Средняя продолжительность серий                                           | `25`                                                               |
| `release.added_in_planned_collection`     | `number`                                                                  | Нет          | Кол-во добавлений в PLANNED коллекцию                                     | `2457`                                                             |
| `release.added_in_watched_collection`     | `number`                                                                  | Нет          | Кол-во добавлений в WATCHED коллекцию                                     | `467`                                                              |
| `release.added_in_watching_collection`    | `number`                                                                  | Нет          | Кол-во добавлений в WATCHING коллекцию                                    | `346`                                                              |
| `release.added_in_postponed_collection`   | `number`                                                                  | Нет          | Кол-во добавлений в POSTPONED коллекцию                                   | `212`                                                              |
| `release.added_in_abandoned_collection`   | `number`                                                                  | Нет          | Кол-во добавлений в ABANDONED коллекцию                                   | `12`                                                               |
| `full_season_is_released`                 | `boolean`                                                                 | Нет          | -                                                                         | `true`                                                             |
| `published_release_episode`               | `object`                                                                  | Нет          | Эпизод релиза                                                             | -                                                                  |
| `published_release_episode.id`            | `string`                                                                  | Нет          | Идентификатор эпизода                                                     | `"9b5e26ee-598f-4b8b-b77e-188d3e456318"`                           |
| `published_release_episode.name`          | `string`                                                                  | Нет          | Название эпизода                                                          | `"Пролог"`                                                         |
| `published_release_episode.ordinal`       | `number`                                                                  | Нет          | Номер эпизода. Может быть целым или дробным числом (например, 5 или 23.5) | `12.5`                                                             |
| `published_release_episode.ending`        | `object`                                                                  | Нет          | Тайминги пропуска опенинга или эндинга                                    | -                                                                  |
| `published_release_episode.ending.start`  | `number`                                                                  | Нет          | Время начала. Количество секунд от начала или конца эпизода               | `6`                                                                |
| `published_release_episode.ending.stop`   | `number`                                                                  | Нет          | Время окончания. Количество секунд от начала или конца эпизода            | `125`                                                              |
| `published_release_episode.opening`       | `object`                                                                  | Нет          | Тайминги пропуска опенинга или эндинга                                    | -                                                                  |
| `published_release_episode.opening.start` | `number`                                                                  | Нет          | Время начала. Количество секунд от начала или конца эпизода               | `6`                                                                |
| `published_release_episode.opening.stop`  | `number`                                                                  | Нет          | Время окончания. Количество секунд от начала или конца эпизода            | `125`                                                              |
| `published_release_episode.preview`       | `object`                                                                  | Нет          | -                                                                         | -                                                                  |
| `published_release_episode.hls_480`       | `string`                                                                  | Нет          | Ссылка на поток 480p                                                      | -                                                                  |
| `published_release_episode.hls_720`       | `string`                                                                  | Нет          | Ссылка на поток 720p                                                      | -                                                                  |
| `published_release_episode.hls_1080`      | `string`                                                                  | Нет          | Ссылка на поток 1080p                                                     | -                                                                  |
| `published_release_episode.duration`      | `number`                                                                  | Нет          | Длительность эпизода в секундах                                           | `1432`                                                             |
| `published_release_episode.rutube_id`     | `string`                                                                  | Нет          | Id эпизода на Rutube                                                      | `"c6cc4d620b1d4338901770a44b3e82f4"`                               |
| `published_release_episode.youtube_id`    | `string`                                                                  | Нет          | Id эпизода на Youtube                                                     | `"dQw4w9WgXcQ"`                                                    |
| `published_release_episode.updated_at`    | `string (date-time)`                                                      | Нет          | Дата обновления эпизода                                                   | `"2021-11-25T18:46:30+00:00"`                                      |
| `published_release_episode.sort_order`    | `number`                                                                  | Нет          | Порядковый номер эпизода для сортировки                                   | `12`                                                               |
| `published_release_episode.release_id`    | `number`                                                                  | Нет          | Идентификатор релиза                                                      | `9324`                                                             |
| `published_release_episode.name_english`  | `string`                                                                  | Нет          | Название эпизода на английском                                            | `"Prologue"`                                                       |
| `next_release_episode_number`             | `integer`                                                                 | Нет          | -                                                                         | `8`                                                                |

<details><summary>Пример объекта</summary>

```json
{
  "release": {
    "id": 7439,
    "type": {
      "value": null,
      "description": "ТВ"
    },
    "year": 2018,
    "name": {
      "main": "Мастера Меча Онлайн: Алисизация",
      "english": "Sword Art Online: Alicization",
      "alternative": "Война в Андерворлде, War of Underworld"
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": "Осень"
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": "16+",
      "is_adult": false,
      "description": "Для людей, достигших возраста шестнадцати лет (16+)"
    },
    "publish_day": {
      "value": null,
      "description": "Воскресенье"
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  },
  "full_season_is_released": true,
  "published_release_episode": {
    "id": "9b5e26ee-598f-4b8b-b77e-188d3e456318",
    "name": "Пролог",
    "ordinal": 12.5,
    "ending": {
      "start": 6,
      "stop": 125
    },
    "opening": {
      "start": 6,
      "stop": 125
    },
    "preview": {},
    "hls_480": "string",
    "hls_720": "string",
    "hls_1080": "string",
    "duration": 1432,
    "rutube_id": "c6cc4d620b1d4338901770a44b3e82f4",
    "youtube_id": "dQw4w9WgXcQ",
    "updated_at": "2021-11-25T18:46:30+00:00",
    "sort_order": 12,
    "release_id": 9324,
    "name_english": "Prologue"
  },
  "next_release_episode_number": 8
}
```
</details>

### `models.anime.sponsors.v1.sponsor`

_Данные по спонсорам_

- **Тип:** `object`

| Поле          | Тип      | Обязательное | Описание          | Пример                     |
| :------------ | :------- | :----------- | :---------------- | :------------------------- |
| `id`          | `string` | Нет          | Transform pattern | `"UUID"`                   |
| `title`       | `string` | Нет          | -                 | `"Sponsor name"`           |
| `description` | `string` | Нет          | -                 | `"Лучший спонсор в мире!"` |
| `url_title`   | `string` | Нет          | -                 | `"Переходи по ссылке"`     |
| `url`         | `string` | Нет          | -                 | `"https://yandex.ru"`      |

<details><summary>Пример объекта</summary>

```json
{
  "id": "UUID",
  "title": "Sponsor name",
  "description": "Лучший спонсор в мире!",
  "url_title": "Переходи по ссылке",
  "url": "https://yandex.ru"
}
```
</details>

### `models.anime.torrents.v1.torrent`

_Данные по торренту_

- **Тип:** `object`

| Поле                     | Тип                                                                                                  | Обязательное | Описание                                                 | Пример                                                          |
| :----------------------- | :--------------------------------------------------------------------------------------------------- | :----------- | :------------------------------------------------------- | :-------------------------------------------------------------- |
| `id`                     | `integer`                                                                                            | Нет          | -                                                        | `18523`                                                         |
| `hash`                   | `string`                                                                                             | Нет          | -                                                        | `"8a8fb94b1bd22b44a116336bab6bf209d0ac3a90"`                    |
| `size`                   | `integer`                                                                                            | Нет          | Размер торрент-файла в байтах                            | `7356495551`                                                    |
| `type`                   | `object`                                                                                             | Нет          | Тип источника видео в торренте                           | -                                                               |
| `type.value`             | `string ["BDRip", "HDRip", "TVRip", "WEBRip", "DTVRip", "DVDRip", "HDTVRip", "WEB-DL", "WEB-DLRip"]` | Нет          | Список возможных значений источника видео (тип релиза)   | -                                                               |
| `type.description`       | `string`                                                                                             | Нет          | -                                                        | `"WEBRip"`                                                      |
| `color`                  | `object`                                                                                             | Нет          | Цветовая глубина видеодорожки в торренте                 | -                                                               |
| `color.value`            | `string ["8bit", "10Bit"]`                                                                           | Нет          | Список возможных значений глубины цвета видеодорожки     | -                                                               |
| `color.description`      | `string`                                                                                             | Нет          | -                                                        | `"8-bit"`                                                       |
| `codec`                  | `object`                                                                                             | Нет          | Информация о кодеке видео в торренте                     | -                                                               |
| `codec.value`            | `string ["AV1", "x264/AVC", "x265/HEVC", "x265hq/HEVC-HQ"]`                                          | Нет          | Список возможных значений кодека видеодорожки в торренте | -                                                               |
| `codec.label`            | `string`                                                                                             | Нет          | -                                                        | `"AVC"`                                                         |
| `codec.description`      | `string`                                                                                             | Нет          | -                                                        | `"x264/AVC"`                                                    |
| `codec.label_color`      | `string`                                                                                             | Нет          | Цвет лейбла                                              | `"#FFF"`                                                        |
| `codec.label_is_visible` | `boolean`                                                                                            | Нет          | Отображать ли лейбл рядом с торрентом                    | `true`                                                          |
| `label`                  | `string`                                                                                             | Нет          | -                                                        | `"Shaman King (2021) - AniLiberty.TOP [WEB-Rip 1080p]"`         |
| `quality`                | `object`                                                                                             | Нет          | Качество видеодорожки в торренте                         | -                                                               |
| `quality.value`          | `string ["360p", "480p", "576p", "720p", "1080p", "2k", "4k", "8k"]`                                 | Нет          | Список возможных значений качества видео в торренте      | -                                                               |
| `quality.description`    | `string`                                                                                             | Нет          | -                                                        | `"1080p"`                                                       |
| `magnet`                 | `string`                                                                                             | Нет          | -                                                        | `"magnet:?xt=urn:btih:QPYNLG5Y2LA2KHB7SZCQF2W3..."`             |
| `filename`               | `string`                                                                                             | Нет          | -                                                        | `"Shaman King (2021) - AniLiberty.TOP [WEB-Rip 1080p].torrent"` |
| `seeders`                | `integer`                                                                                            | Нет          | Количество сидеров                                       | `234`                                                           |
| `bitrate`                | `integer`                                                                                            | Нет          | Битрейт, Кбит/сек                                        | `3400`                                                          |
| `leechers`               | `integer`                                                                                            | Нет          | Количество личеров                                       | `58`                                                            |
| `sort_order`             | `integer`                                                                                            | Нет          | Порядок сортировки торрента внутри релиза                | `2`                                                             |
| `updated_at`             | `string (date-time)`                                                                                 | Нет          | -                                                        | `"2021-09-22T16:20:38+00:00"`                                   |
| `is_hardsub`             | `boolean`                                                                                            | Нет          | Является ли торрент хардсабом                            | `true`                                                          |
| `description`            | `string`                                                                                             | Нет          | Описание торрента                                        | `"1-17 + OVA(1-4)"`                                             |
| `created_at`             | `string (date-time)`                                                                                 | Нет          | -                                                        | `"2021-09-21T11:45:00+00:00"`                                   |
| `completed_times`        | `integer`                                                                                            | Нет          | Общее количество скачиваний торрента                     | `13538`                                                         |

<details><summary>Пример объекта</summary>

```json
{
  "id": 18523,
  "hash": "8a8fb94b1bd22b44a116336bab6bf209d0ac3a90",
  "size": 7356495551,
  "type": {
    "value": "BDRip",
    "description": "WEBRip"
  },
  "color": {
    "value": "8bit",
    "description": "8-bit"
  },
  "codec": {
    "value": "AV1",
    "label": "AVC",
    "description": "x264/AVC",
    "label_color": "#FFF",
    "label_is_visible": true
  },
  "label": "Shaman King (2021) - AniLiberty.TOP [WEB-Rip 1080p]",
  "quality": {
    "value": "360p",
    "description": "1080p"
  },
  "magnet": "magnet:?xt=urn:btih:QPYNLG5Y2LA2KHB7SZCQF2W3...",
  "filename": "Shaman King (2021) - AniLiberty.TOP [WEB-Rip 1080p].torrent",
  "seeders": 234,
  "bitrate": 3400,
  "leechers": 58,
  "sort_order": 2,
  "updated_at": "2021-09-22T16:20:38+00:00",
  "is_hardsub": true,
  "description": "1-17 + OVA(1-4)",
  "created_at": "2021-09-21T11:45:00+00:00",
  "completed_times": 13538
}
```
</details>

### `models.anime.torrents.v1.torrent.codec`

_Информация о кодеке видео в торренте_

- **Тип:** `object`

| Поле               | Тип                                                         | Обязательное | Описание                                                 | Пример       |
| :----------------- | :---------------------------------------------------------- | :----------- | :------------------------------------------------------- | :----------- |
| `value`            | `string ["AV1", "x264/AVC", "x265/HEVC", "x265hq/HEVC-HQ"]` | Нет          | Список возможных значений кодека видеодорожки в торренте | -            |
| `label`            | `string`                                                    | Нет          | -                                                        | `"AVC"`      |
| `description`      | `string`                                                    | Нет          | -                                                        | `"x264/AVC"` |
| `label_color`      | `string`                                                    | Нет          | Цвет лейбла                                              | `"#FFF"`     |
| `label_is_visible` | `boolean`                                                   | Нет          | Отображать ли лейбл рядом с торрентом                    | `true`       |

<details><summary>Пример объекта</summary>

```json
{
  "value": "AV1",
  "label": "AVC",
  "description": "x264/AVC",
  "label_color": "#FFF",
  "label_is_visible": true
}
```
</details>

### `models.anime.torrents.v1.torrent.color`

_Цветовая глубина видеодорожки в торренте_

- **Тип:** `object`

| Поле          | Тип                        | Обязательное | Описание                                             | Пример    |
| :------------ | :------------------------- | :----------- | :--------------------------------------------------- | :-------- |
| `value`       | `string ["8bit", "10Bit"]` | Нет          | Список возможных значений глубины цвета видеодорожки | -         |
| `description` | `string`                   | Нет          | -                                                    | `"8-bit"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "8bit",
  "description": "8-bit"
}
```
</details>

### `models.anime.torrents.v1.torrent.member`

_Данные по участнику торрента_

- **Тип:** `object`

| Поле               | Тип               | Обязательное | Описание                                  | Пример                                   |
| :----------------- | :---------------- | :----------- | :---------------------------------------- | :--------------------------------------- |
| `id`               | `string`          | Нет          | -                                         | `"6240acf7-4f62-4de9-9cc0-b3984ccc2b35"` |
| `role`             | `object`          | Нет          | Роль, которую выполняет участник торрента | -                                        |
| `role.value`       | `string ["HEVC"]` | Нет          | Список ролей участников торрента          | -                                        |
| `role.description` | `string`          | Нет          | -                                         | `"HEVC"`                                 |
| `nickname`         | `string`          | Нет          | -                                         | `"Tuxoid"`                               |
| `external_url`     | `string`          | Нет          | -                                         | `"https://t.me/Animeshnik488"`           |

<details><summary>Пример объекта</summary>

```json
{
  "id": "6240acf7-4f62-4de9-9cc0-b3984ccc2b35",
  "role": {
    "value": "HEVC",
    "description": "HEVC"
  },
  "nickname": "Tuxoid",
  "external_url": "https://t.me/Animeshnik488"
}
```
</details>

### `models.anime.torrents.v1.torrent.member.role`

_Роль, которую выполняет участник торрента_

- **Тип:** `object`

| Поле          | Тип               | Обязательное | Описание                         | Пример   |
| :------------ | :---------------- | :----------- | :------------------------------- | :------- |
| `value`       | `string ["HEVC"]` | Нет          | Список ролей участников торрента | -        |
| `description` | `string`          | Нет          | -                                | `"HEVC"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "HEVC",
  "description": "HEVC"
}
```
</details>

### `models.anime.torrents.v1.torrent.member.user`

_Данные по связанному с участником торрента пользователю_

- **Тип:** `object`

| Поле     | Тип      | Обязательное | Описание | Пример |
| :------- | :------- | :----------- | :------- | :----- |
| `id`     | `number` | Нет          | -        | `2346` |
| `avatar` | `object` | Нет          | -        | -      |

<details><summary>Пример объекта</summary>

```json
{
  "id": 2346,
  "avatar": {}
}
```
</details>

### `models.anime.torrents.v1.torrent.quality`

_Качество видеодорожки в торренте_

- **Тип:** `object`

| Поле          | Тип                                                                  | Обязательное | Описание                                            | Пример    |
| :------------ | :------------------------------------------------------------------- | :----------- | :-------------------------------------------------- | :-------- |
| `value`       | `string ["360p", "480p", "576p", "720p", "1080p", "2k", "4k", "8k"]` | Нет          | Список возможных значений качества видео в торренте | -         |
| `description` | `string`                                                             | Нет          | -                                                   | `"1080p"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "360p",
  "description": "1080p"
}
```
</details>

### `models.anime.torrents.v1.torrent.type`

_Тип источника видео в торренте_

- **Тип:** `object`

| Поле          | Тип                                                                                                  | Обязательное | Описание                                               | Пример     |
| :------------ | :--------------------------------------------------------------------------------------------------- | :----------- | :----------------------------------------------------- | :--------- |
| `value`       | `string ["BDRip", "HDRip", "TVRip", "WEBRip", "DTVRip", "DVDRip", "HDTVRip", "WEB-DL", "WEB-DLRip"]` | Нет          | Список возможных значений источника видео (тип релиза) | -          |
| `description` | `string`                                                                                             | Нет          | -                                                      | `"WEBRip"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "BDRip",
  "description": "WEBRip"
}
```
</details>

### `models.media.promotions.v1.promotion`

_Данные по промо-материалам_

- **Тип:** `object`

| Поле                                    | Тип                                                                       | Обязательное | Описание                                            | Пример                                                                                   |
| :-------------------------------------- | :------------------------------------------------------------------------ | :----------- | :-------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| `id`                                    | `string`                                                                  | Нет          | -                                                   | `"bad864a4-d1b9-473f-898f-da8ee800ef87"`                                                 |
| `url`                                   | `string`                                                                  | Нет          | Кастомная ссылка на промо-материал                  | `"https://espritgames.ru/dragoncontract/promotions/getdragon"`                           |
| `url_label`                             | `string`                                                                  | Нет          | Кастомная подпись к ссылке                          | `"Перейти на сайт"`                                                                      |
| `image`                                 | `object`                                                                  | Нет          | -                                                   | -                                                                                        |
| `title`                                 | `string`                                                                  | Нет          | Кастомное название промо-материала                  | `"Dragon Contract"`                                                                      |
| `description`                           | `string`                                                                  | Нет          | Кастомное описание промо-материала                  | `"ИСПЫТАЙ СВОЮ ПАМЯТЬ! Собери все пары карточек правильно, и получи дракона на старте!"` |
| `is_ad`                                 | `boolean`                                                                 | Нет          | Флаг рекламной промо кампании                       | `true`                                                                                   |
| `ad_erid`                               | `string`                                                                  | Нет          | -                                                   | -                                                                                        |
| `ad_origin`                             | `string`                                                                  | Нет          | -                                                   | -                                                                                        |
| `release`                               | `object`                                                                  | Нет          | Данные по релизу                                    | -                                                                                        |
| `release.id`                            | `number`                                                                  | Нет          | Идентификатор релиза                                | `7439`                                                                                   |
| `release.type`                          | `object`                                                                  | Нет          | Тип релиза                                          | -                                                                                        |
| `release.type.value`                    | `string ["TV", "ONA", "WEB", "OVA", "OAD", "MOVIE", "DORAMA", "SPECIAL"]` | Нет          | -                                                   | -                                                                                        |
| `release.type.description`              | `string`                                                                  | Нет          | -                                                   | `"ТВ"`                                                                                   |
| `release.year`                          | `number`                                                                  | Нет          | Год                                                 | `2018`                                                                                   |
| `release.name`                          | `object`                                                                  | Нет          | Название релиза                                     | -                                                                                        |
| `release.name.main`                     | `string`                                                                  | Нет          | -                                                   | `"Мастера Меча Онлайн: Алисизация"`                                                      |
| `release.name.english`                  | `string`                                                                  | Нет          | -                                                   | `"Sword Art Online: Alicization"`                                                        |
| `release.name.alternative`              | `string`                                                                  | Нет          | -                                                   | `"Война в Андерворлде, War of Underworld"`                                               |
| `release.alias`                         | `string`                                                                  | Нет          | Ссылка на релиз                                     | `"sword-art-online-alicization"`                                                         |
| `release.season`                        | `object`                                                                  | Нет          | Сезон релиза                                        | -                                                                                        |
| `release.season.value`                  | `string ["winter", "spring", "summer", "autumn"]`                         | Нет          | -                                                   | -                                                                                        |
| `release.season.description`            | `string`                                                                  | Нет          | -                                                   | `"Осень"`                                                                                |
| `release.poster`                        | `object`                                                                  | Нет          | -                                                   | -                                                                                        |
| `release.fresh_at`                      | `string (date-time)`                                                      | Нет          | Дата поднятия релиза                                | `"2019-12-29T23:06:39+00:00"`                                                            |
| `release.created_at`                    | `string (date-time)`                                                      | Нет          | Дата создания релиза                                | `"2019-12-29T23:06:39+00:00"`                                                            |
| `release.updated_at`                    | `string (date-time)`                                                      | Нет          | Дата обновления релиза                              | `"2023-08-20T15:08:20+00:00"`                                                            |
| `release.is_ongoing`                    | `boolean`                                                                 | Нет          | Релиз в данный момент выходит в стране производства | `false`                                                                                  |
| `release.age_rating`                    | `object`                                                                  | Нет          | Возрастное ограничение                              | -                                                                                        |
| `release.age_rating.value`              | `string ["R0_PLUS", "R6_PLUS", "R12_PLUS", "R16_PLUS", "R18_PLUS"]`       | Нет          | -                                                   | -                                                                                        |
| `release.age_rating.label`              | `string`                                                                  | Нет          | -                                                   | `"16+"`                                                                                  |
| `release.age_rating.is_adult`           | `boolean`                                                                 | Нет          | -                                                   | `false`                                                                                  |
| `release.age_rating.description`        | `string`                                                                  | Нет          | -                                                   | `"Для людей, достигших возраста шестнадцати лет (16+)"`                                  |
| `release.publish_day`                   | `object`                                                                  | Нет          | День выхода релиза                                  | -                                                                                        |
| `release.publish_day.value`             | `integer ["1", "2", "3", "4", "5", "6", "7"]`                             | Нет          | -                                                   | -                                                                                        |
| `release.publish_day.description`       | `string`                                                                  | Нет          | -                                                   | `"Воскресенье"`                                                                          |
| `release.description`                   | `string`                                                                  | Нет          | Описание релиза                                     | `"Underworld - мир, ранее недоступный человеческому пониманию..."`                       |
| `release.notification`                  | `string`                                                                  | Нет          | Важная информация / Оповещение                      | `"Серии выходят по воскресеньям"`                                                        |
| `release.episodes_total`                | `number`                                                                  | Нет          | Всего эпизодов                                      | `36`                                                                                     |
| `release.external_player`               | `string`                                                                  | Нет          | Ссылка на внешний плеер                             | `"//kodik.info/serial/..."`                                                              |
| `release.is_in_production`              | `boolean`                                                                 | Нет          | Релиз в работе / озвучивается                       | `false`                                                                                  |
| `release.is_blocked_by_geo`             | `boolean`                                                                 | Нет          | Блокировка по геолокации                            | `false`                                                                                  |
| `release.is_blocked_by_copyrights`      | `boolean`                                                                 | Нет          | Релиз заблокирован правообладателем                 | `false`                                                                                  |
| `release.added_in_users_favorites`      | `number`                                                                  | Нет          | Рейтинг по добавлению в коллекцию                   | `25557`                                                                                  |
| `release.average_duration_of_episode`   | `number`                                                                  | Нет          | Средняя продолжительность серий                     | `25`                                                                                     |
| `release.added_in_planned_collection`   | `number`                                                                  | Нет          | Кол-во добавлений в PLANNED коллекцию               | `2457`                                                                                   |
| `release.added_in_watched_collection`   | `number`                                                                  | Нет          | Кол-во добавлений в WATCHED коллекцию               | `467`                                                                                    |
| `release.added_in_watching_collection`  | `number`                                                                  | Нет          | Кол-во добавлений в WATCHING коллекцию              | `346`                                                                                    |
| `release.added_in_postponed_collection` | `number`                                                                  | Нет          | Кол-во добавлений в POSTPONED коллекцию             | `212`                                                                                    |
| `release.added_in_abandoned_collection` | `number`                                                                  | Нет          | Кол-во добавлений в ABANDONED коллекцию             | `12`                                                                                     |
| `has_overlay`                           | `boolean`                                                                 | Нет          | Использовать темный оверлей                         | `true`                                                                                   |

<details><summary>Пример объекта</summary>

```json
{
  "id": "bad864a4-d1b9-473f-898f-da8ee800ef87",
  "url": "https://espritgames.ru/dragoncontract/promotions/getdragon",
  "url_label": "Перейти на сайт",
  "image": {},
  "title": "Dragon Contract",
  "description": "ИСПЫТАЙ СВОЮ ПАМЯТЬ! Собери все пары карточек правильно, и получи дракона на старте!",
  "is_ad": true,
  "ad_erid": "string",
  "ad_origin": "string",
  "release": {
    "id": 7439,
    "type": {
      "value": null,
      "description": "ТВ"
    },
    "year": 2018,
    "name": {
      "main": "Мастера Меча Онлайн: Алисизация",
      "english": "Sword Art Online: Alicization",
      "alternative": "Война в Андерворлде, War of Underworld"
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": "Осень"
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": "16+",
      "is_adult": false,
      "description": "Для людей, достигших возраста шестнадцати лет (16+)"
    },
    "publish_day": {
      "value": null,
      "description": "Воскресенье"
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  },
  "has_overlay": true
}
```
</details>

### `models.media.videos.v1.video.content`

_Данные по видео роликам_

- **Тип:** `object`

| Поле          | Тип                  | Обязательное | Описание                            | Пример                                          |
| :------------ | :------------------- | :----------- | :---------------------------------- | :---------------------------------------------- |
| `id`          | `integer`            | Нет          | -                                   | `57`                                            |
| `url`         | `string`             | Нет          | -                                   | `"https://www.youtube.com/watch?v=8f6FpV4sB0I"` |
| `title`       | `string`             | Нет          | -                                   | `"ТОП 10 САМЫХ ОЖИДАЕМЫХ АНИМЕ ОСЕНИ 2021"`     |
| `views`       | `integer`            | Нет          | Количество просмотров ролика        | `34456`                                         |
| `image`       | `object`             | Нет          | -                                   | -                                               |
| `comments`    | `integer`            | Нет          | Количество комментариев под роликом | `532`                                           |
| `video_id`    | `string`             | Нет          | -                                   | `"8f6FpV4sB0I"`                                 |
| `created_at`  | `string (date-time)` | Нет          | -                                   | `"2021-09-22T16:20:38+00:00"`                   |
| `updated_at`  | `string (date-time)` | Нет          | Дата последнего обновления данных   | `"2021-09-28T19:40:26+00:00"`                   |
| `is_announce` | `boolean`            | Нет          | Видео является анонсом сезона       | `true`                                          |

<details><summary>Пример объекта</summary>

```json
{
  "id": 57,
  "url": "https://www.youtube.com/watch?v=8f6FpV4sB0I",
  "title": "ТОП 10 САМЫХ ОЖИДАЕМЫХ АНИМЕ ОСЕНИ 2021",
  "views": 34456,
  "image": {},
  "comments": 532,
  "video_id": "8f6FpV4sB0I",
  "created_at": "2021-09-22T16:20:38+00:00",
  "updated_at": "2021-09-28T19:40:26+00:00",
  "is_announce": true
}
```
</details>

### `models.media.videos.v1.video.origin`

_Данные по видео-источнику_

- **Тип:** `object`

| Поле               | Тип                           | Обязательное | Описание                               | Пример                                                                       |
| :----------------- | :---------------------------- | :----------- | :------------------------------------- | :--------------------------------------------------------------------------- |
| `id`               | `string`                      | Нет          | -                                      | `"e8fd32be-7f14-4c02-bf00-dbd26ecabfdb"`                                     |
| `url`              | `string`                      | Нет          | -                                      | `"https://www.youtube.com/playlist?list=PL8_g6JPJBRglxkyQfNGugDyyQP11hL0-Q"` |
| `type`             | `object`                      | Нет          | Тип источника видео                    | -                                                                            |
| `type.value`       | `string ["YOUTUBE_PLAYLIST"]` | Нет          | Перечисление типов источников видео    | `"YOUTUBE_PLAYLIST"`                                                         |
| `type.description` | `string`                      | Нет          | -                                      | `"YouTube плейлист"`                                                         |
| `title`            | `string`                      | Нет          | -                                      | `"Анонсы аниме-сезонов"`                                                     |
| `description`      | `string`                      | Нет          | -                                      | `"Плейлист с анонсами"`                                                      |
| `is_announce`      | `boolean`                     | Нет          | Видео-источник является анонсом сезона | `true`                                                                       |

<details><summary>Пример объекта</summary>

```json
{
  "id": "e8fd32be-7f14-4c02-bf00-dbd26ecabfdb",
  "url": "https://www.youtube.com/playlist?list=PL8_g6JPJBRglxkyQfNGugDyyQP11hL0-Q",
  "type": {
    "value": "YOUTUBE_PLAYLIST",
    "description": "YouTube плейлист"
  },
  "title": "Анонсы аниме-сезонов",
  "description": "Плейлист с анонсами",
  "is_announce": true
}
```
</details>

### `models.media.videos.v1.video.origin.type`

_Тип источника видео_

- **Тип:** `object`

| Поле          | Тип                           | Обязательное | Описание                            | Пример               |
| :------------ | :---------------------------- | :----------- | :---------------------------------- | :------------------- |
| `value`       | `string ["YOUTUBE_PLAYLIST"]` | Нет          | Перечисление типов источников видео | `"YOUTUBE_PLAYLIST"` |
| `description` | `string`                      | Нет          | -                                   | `"YouTube плейлист"` |

<details><summary>Пример объекта</summary>

```json
{
  "value": "YOUTUBE_PLAYLIST",
  "description": "YouTube плейлист"
}
```
</details>

### `models.teams.v1.team`

_Данные по команде_

- **Тип:** `object`

| Поле          | Тип       | Обязательное | Описание                   | Пример |
| :------------ | :-------- | :----------- | :------------------------- | :----- |
| `id`          | `string`  | Нет          | ID команды                 | -      |
| `title`       | `string`  | Нет          | Название команды           | -      |
| `sort_order`  | `integer` | Нет          | Порядок сортировки команды | -      |
| `description` | `string`  | Нет          | Описание команды           | -      |

<details><summary>Пример объекта</summary>

```json
{
  "id": "string",
  "title": "string",
  "sort_order": 0,
  "description": "string"
}
```
</details>

### `models.teams.v1.team.role`

_Данные по роли в команде_

- **Тип:** `object`

| Поле         | Тип       | Обязательное | Описание                | Пример |
| :----------- | :-------- | :----------- | :---------------------- | :----- |
| `id`         | `string`  | Нет          | ID роли                 | -      |
| `title`      | `string`  | Нет          | Название роли           | -      |
| `color`      | `string`  | Нет          | Цвет                    | -      |
| `sort_order` | `integer` | Нет          | Порядок сортировки роли | -      |

<details><summary>Пример объекта</summary>

```json
{
  "id": "string",
  "title": "string",
  "color": "string",
  "sort_order": 0
}
```
</details>

### `models.teams.v1.team.user`

_Данные по анилибрийцу_

- **Тип:** `object`

| Поле          | Тип       | Обязательное | Описание                                               | Пример |
| :------------ | :-------- | :----------- | :----------------------------------------------------- | :----- |
| `id`          | `string`  | Нет          | ID анилибрийца                                         | -      |
| `nickname`    | `string`  | Нет          | Псевдоним анилибрийца в команде                        | -      |
| `is_intern`   | `boolean` | Нет          | Флаг, указывающий, является ли пользователь стажером   | -      |
| `sort_order`  | `integer` | Нет          | Порядок сортировки внутри команды                      | -      |
| `is_vacation` | `boolean` | Нет          | Флаг, указывающий, находится ли пользователь в отпуске | -      |

<details><summary>Пример объекта</summary>

```json
{
  "id": "string",
  "nickname": "string",
  "is_intern": true,
  "sort_order": 0,
  "is_vacation": true
}
```
</details>

### `models.teams.v1.team.user.account`

_Данные по аккаунту пользователю_

- **Тип:** `object`

| Поле       | Тип       | Обязательное | Описание                        | Пример |
| :--------- | :-------- | :----------- | :------------------------------ | :----- |
| `id`       | `integer` | Нет          | ID анилибрийца                  | -      |
| `nickname` | `string`  | Нет          | Псевдоним анилибрийца в команде | -      |
| `avatar`   | `object`  | Нет          | -                               | -      |

<details><summary>Пример объекта</summary>

```json
{
  "id": 0,
  "nickname": "string",
  "avatar": {}
}
```
</details>

### `models.users.v1.user`

_Данные по пользователю_

- **Тип:** `object`

| Поле                  | Тип                  | Обязательное | Описание                                 | Пример                            |
| :-------------------- | :------------------- | :----------- | :--------------------------------------- | :-------------------------------- |
| `id`                  | `integer`            | Нет          | Transform pattern                        | `4837362`                         |
| `login`               | `string`             | Нет          | Отображается только собственный          | `"animeshnik_488"`                |
| `email`               | `string`             | Нет          | Отображается только собственный          | `"animeshnik_488@protonmail.com"` |
| `nickname`            | `string`             | Нет          | -                                        | `"Animeshnik488"`                 |
| `avatar`              | `object`             | Нет          | -                                        | -                                 |
| `torrents`            | `object`             | Нет          | Данные по торрентам                      | -                                 |
| `torrents.passkey`    | `string`             | Нет          | passkey, отображается только собственный | `"xBSmRDA95bJXPk3E"`              |
| `torrents.uploaded`   | `integer`            | Нет          | Количество отданного, в байтах           | `998234623`                       |
| `torrents.downloaded` | `integer`            | Нет          | Количество скачанного, в байтах          | `2397162874432`                   |
| `is_banned`           | `boolean`            | Нет          | Забанен ли пользоваель в данный момент   | `true`                            |
| `created_at`          | `string (date-time)` | Нет          | -                                        | `"2019-03-31T20:43:52+00:00"`     |
| `is_with_ads`         | `boolean`            | Нет          | Отображение рекламы                      | `false`                           |

<details><summary>Пример объекта</summary>

```json
{
  "id": 4837362,
  "login": "animeshnik_488",
  "email": "animeshnik_488@protonmail.com",
  "nickname": "Animeshnik488",
  "avatar": {},
  "torrents": {
    "passkey": "xBSmRDA95bJXPk3E",
    "uploaded": 998234623,
    "downloaded": 2397162874432
  },
  "is_banned": true,
  "created_at": "2019-03-31T20:43:52+00:00",
  "is_with_ads": false
}
```
</details>

### `models.users.v1.user.session`

_Данные по сессии пользователя_

- **Тип:** `object`

| Поле                | Тип                  | Обязательное | Описание                 | Пример                                              |
| :------------------ | :------------------- | :----------- | :----------------------- | :-------------------------------------------------- |
| `id`                | `string`             | Нет          | Transform pattern        | `"XbSmRDA95bJXPk3E"`                                |
| `user_id`           | `integer`            | Нет          | -                        | `482903`                                            |
| `device`            | `object`             | Нет          | Информация об устройстве | -                                                   |
| `device.name`       | `string`             | Нет          | -                        | `"Macintosh"`                                       |
| `device.version`    | `string`             | Нет          | -                        | `"10.15"`                                           |
| `device.platform`   | `string`             | Нет          | -                        | `"Mac OS X"`                                        |
| `browser`           | `object`             | Нет          | Информация о браузере    | -                                                   |
| `browser.name`      | `string`             | Нет          | -                        | `"Chrome"`                                          |
| `browser.version`   | `string`             | Нет          | -                        | `"112.0"`                                           |
| `location`          | `object`             | Нет          | Геолокация пользователя  | -                                                   |
| `location.country`  | `string`             | Нет          | -                        | `"Russia"`                                          |
| `location.iso_code` | `string`             | Нет          | -                        | `"RU"`                                              |
| `is_mobile`         | `boolean`            | Нет          | Мобильное устройство     | `false`                                             |
| `is_desktop`        | `boolean`            | Нет          | Десктопное устройство    | `true`                                              |
| `ip_address`        | `string`             | Нет          | IP-адрес                 | `"192.168.1.1"`                                     |
| `user_agent`        | `string`             | Нет          | User-Agent               | `"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"` |
| `is_current`        | `boolean`            | Нет          | Текущая сессия           | `true`                                              |
| `last_active`       | `string (date-time)` | Нет          | -                        | `"2024-03-01T12:34:56+00:00"`                       |

<details><summary>Пример объекта</summary>

```json
{
  "id": "XbSmRDA95bJXPk3E",
  "user_id": 482903,
  "device": {
    "name": "Macintosh",
    "version": "10.15",
    "platform": "Mac OS X"
  },
  "browser": {
    "name": "Chrome",
    "version": "112.0"
  },
  "location": {
    "country": "Russia",
    "iso_code": "RU"
  },
  "is_mobile": false,
  "is_desktop": true,
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "is_current": true,
  "last_active": "2024-03-01T12:34:56+00:00"
}
```
</details>

### `responses.api.v1.accounts.otp.get`

- **Тип:** `object`

| Поле             | Тип                  | Обязательное | Описание           | Пример                                   |
| :--------------- | :------------------- | :----------- | :----------------- | :--------------------------------------- |
| `otp`            | `object`             | Нет          | Данные по OTP коду | -                                        |
| `otp.code`       | `string`             | Нет          | -                  | `"058701"`                               |
| `otp.user_id`    | `integer`            | Нет          | -                  | `1337`                                   |
| `otp.device_id`  | `string`             | Нет          | -                  | `"n702175b-fa52-5251-a39z-d1f4af0w1cak"` |
| `otp.expired_at` | `string (date-time)` | Нет          | Срок действия кода | `"2021-09-28T19:40:26+00:00"`            |
| `remaining_time` | `integer`            | Нет          | -                  | `120`                                    |

<details><summary>Пример объекта</summary>

```json
{
  "otp": {
    "code": "058701",
    "user_id": 1337,
    "device_id": "n702175b-fa52-5251-a39z-d1f4af0w1cak",
    "expired_at": "2021-09-28T19:40:26+00:00"
  },
  "remaining_time": 120
}
```
</details>

### `responses.api.v1.accounts.otp.login`

- **Тип:** `object`

| Поле    | Тип      | Обязательное | Описание | Пример                                                                                                     |
| :------ | :------- | :----------- | :------- | :--------------------------------------------------------------------------------------------------------- |
| `token` | `string` | Нет          | -        | `"eyJpdiI6ImJDeElkYzliNFBDb2VFMDdtdnZpdVE9PSIsInZhbHVlIjoiM0Y5SnVINno3NndBbUcvU2NPVjJhMmhTMllJdWd4WUlF=="` |

<details><summary>Пример объекта</summary>

```json
{
  "token": "eyJpdiI6ImJDeElkYzliNFBDb2VFMDdtdnZpdVE9PSIsInZhbHVlIjoiM0Y5SnVINno3NndBbUcvU2NPVjJhMmhTMllJdWd4WUlF=="
}
```
</details>

### `responses.api.v1.accounts.users.me.collections.ids`

- **Тип:** `array`

### `responses.api.v1.accounts.users.me.collections.ids.item`

- **Тип:** `object`

### `responses.api.v1.accounts.users.me.collections.references.ageRatings`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "R0_PLUS",
    "label": "string",
    "description": "string"
  }
]
```
</details>

### `responses.api.v1.accounts.users.me.collections.references.genres`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 0,
    "name": "string"
  }
]
```
</details>

### `responses.api.v1.accounts.users.me.collections.references.types`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "TV",
    "description": "string"
  }
]
```
</details>

### `responses.api.v1.accounts.users.me.collections.references.years`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[2020, 2021, 2022, 2023]
```
</details>

### `responses.api.v1.accounts.users.me.favorites.references.ageRatings`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "R0_PLUS",
    "label": "string",
    "description": "string"
  }
]
```
</details>

### `responses.api.v1.accounts.users.me.favorites.references.genres`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 0,
    "name": "string"
  }
]
```
</details>

### `responses.api.v1.accounts.users.me.favorites.references.sorting`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "CREATED_AT_DESC",
    "label": "string",
    "description": "string"
  }
]
```
</details>

### `responses.api.v1.accounts.users.me.favorites.references.types`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "TV",
    "description": "string"
  }
]
```
</details>

### `responses.api.v1.accounts.users.me.favorites.references.years`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[2020, 2021, 2022, 2023]
```
</details>

### `responses.api.v1.ads.vasts`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": "17974e6e-da62-427b-9937-9021cf4cafe4",
    "url": "https://example.com/vast.xml",
    "ad_erid": "ERID123456789",
    "ad_company_itn": "1234567890",
    "ad_company_name": "Company XYZ"
  }
]
```
</details>

### `responses.api.v1.anime.catalog.references.ageRatings`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "R0_PLUS",
    "label": "PG-17",
    "description": "PG"
  }
]
```
</details>

### `responses.api.v1.anime.catalog.references.genres`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 23,
    "name": "Мистика"
  }
]
```
</details>

### `responses.api.v1.anime.catalog.references.productionStatuses`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "IS_IN_PRODUCTION",
    "description": "Сейчас в озвучке"
  }
]
```
</details>

### `responses.api.v1.anime.catalog.references.publishStatuses`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "IS_ONGOING",
    "description": "Онгоинг"
  }
]
```
</details>

### `responses.api.v1.anime.catalog.releases`

- **Тип:** `object`

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": "/api/version/path-to-resource?page=1",
        "next": "/api/version/path-to-resource?page=3"
      }
    }
  }
}
```
</details>

### `responses.api.v1.anime.genres`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 21,
    "name": "Комедия",
    "image": {},
    "total_releases": 10
  }
]
```
</details>

### `responses.api.v1.anime.genres.item`

- **Тип:** `object`

### `responses.api.v1.anime.genres.list`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 21,
    "name": "Комедия",
    "image": {},
    "total_releases": 10
  }
]
```
</details>

### `responses.api.v1.anime.genres.releases`

- **Тип:** `object`

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "data": [
    {
      "id": 7439,
      "type": {
        "value": null,
        "description": null
      },
      "year": 2018,
      "name": {
        "main": null,
        "english": null,
        "alternative": null
      },
      "alias": "sword-art-online-alicization",
      "season": {
        "value": null,
        "description": null
      },
      "poster": {},
      "fresh_at": "2019-12-29T23:06:39+00:00",
      "created_at": "2019-12-29T23:06:39+00:00",
      "updated_at": "2023-08-20T15:08:20+00:00",
      "is_ongoing": false,
      "age_rating": {
        "value": null,
        "label": null,
        "is_adult": null,
        "description": null
      },
      "publish_day": {
        "value": null,
        "description": null
      },
      "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
      "notification": "Серии выходят по воскресеньям",
      "episodes_total": 36,
      "external_player": "//kodik.info/serial/...",
      "is_in_production": false,
      "is_blocked_by_geo": false,
      "is_blocked_by_copyrights": false,
      "added_in_users_favorites": 25557,
      "average_duration_of_episode": 25,
      "added_in_planned_collection": 2457,
      "added_in_watched_collection": 467,
      "added_in_watching_collection": 346,
      "added_in_postponed_collection": 212,
      "added_in_abandoned_collection": 12
    }
  ],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": "/api/version/path-to-resource?page=1",
        "next": "/api/version/path-to-resource?page=3"
      }
    }
  }
}
```
</details>

### `responses.api.v1.anime.releases.episode`

- **Тип:** `object`

### `responses.api.v1.anime.releases.episode.timecode`

- **Тип:** `object`

### `responses.api.v1.anime.releases.latest`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[{}]
```
</details>

### `responses.api.v1.anime.releases.list`

- **Тип:** `object`

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": "/api/version/path-to-resource?page=1",
        "next": "/api/version/path-to-resource?page=3"
      }
    }
  }
}
```
</details>

### `responses.api.v1.anime.releases.random`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 7439,
    "type": {
      "value": null,
      "description": "ТВ"
    },
    "year": 2018,
    "name": {
      "main": "Мастера Меча Онлайн: Алисизация",
      "english": "Sword Art Online: Alicization",
      "alternative": "Война в Андерворлде, War of Underworld"
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": "Осень"
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": "16+",
      "is_adult": false,
      "description": "Для людей, достигших возраста шестнадцати лет (16+)"
    },
    "publish_day": {
      "value": null,
      "description": "Воскресенье"
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  }
]
```
</details>

### `responses.api.v1.anime.releases.recommended`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 7439,
    "type": {
      "value": null,
      "description": "ТВ"
    },
    "year": 2018,
    "name": {
      "main": "Мастера Меча Онлайн: Алисизация",
      "english": "Sword Art Online: Alicization",
      "alternative": "Война в Андерворлде, War of Underworld"
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": "Осень"
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": "16+",
      "is_adult": false,
      "description": "Для людей, достигших возраста шестнадцати лет (16+)"
    },
    "publish_day": {
      "value": null,
      "description": "Воскресенье"
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  }
]
```
</details>

### `responses.api.v1.anime.releases.release`

- **Тип:** `object`

### `responses.api.v1.anime.releases.release.episodes.timecodes`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 123,
    "time": 127.45,
    "user_id": 42,
    "is_watched": true,
    "updated_at": "2025-06-23T14:00:00+00:00",
    "release_episode_id": "9b5e26ee-598f-4b8b-b77e-188d3e456318"
  }
]
```
</details>

### `responses.api.v1.anime.releases.release.members`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": "uuid...",
    "role": {
      "value": null,
      "description": "Озвучка"
    },
    "user": null,
    "nickname": "Zvukar"
  }
]
```
</details>

### `responses.api.v1.anime.torrent`

- **Тип:** `object`

### `responses.api.v1.anime.torrents`

- **Тип:** `object`

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": "/api/version/path-to-resource?page=1",
        "next": "/api/version/path-to-resource?page=3"
      }
    }
  }
}
```
</details>

### `responses.api.v1.anime.torrents.releaseTorrents`

- **Тип:** `array`

### `responses.api.v1.app.search.releases`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": 7439,
    "type": {
      "value": null,
      "description": "ТВ"
    },
    "year": 2018,
    "name": {
      "main": "Мастера Меча Онлайн: Алисизация",
      "english": "Sword Art Online: Alicization",
      "alternative": "Война в Андерворлде, War of Underworld"
    },
    "alias": "sword-art-online-alicization",
    "season": {
      "value": null,
      "description": "Осень"
    },
    "poster": {},
    "fresh_at": "2019-12-29T23:06:39+00:00",
    "created_at": "2019-12-29T23:06:39+00:00",
    "updated_at": "2023-08-20T15:08:20+00:00",
    "is_ongoing": false,
    "age_rating": {
      "value": null,
      "label": "16+",
      "is_adult": false,
      "description": "Для людей, достигших возраста шестнадцати лет (16+)"
    },
    "publish_day": {
      "value": null,
      "description": "Воскресенье"
    },
    "description": "Underworld - мир, ранее недоступный человеческому пониманию...",
    "notification": "Серии выходят по воскресеньям",
    "episodes_total": 36,
    "external_player": "//kodik.info/serial/...",
    "is_in_production": false,
    "is_blocked_by_geo": false,
    "is_blocked_by_copyrights": false,
    "added_in_users_favorites": 25557,
    "average_duration_of_episode": 25,
    "added_in_planned_collection": 2457,
    "added_in_watched_collection": 467,
    "added_in_watching_collection": 346,
    "added_in_postponed_collection": 212,
    "added_in_abandoned_collection": 12
  }
]
```
</details>

### `responses.api.v1.teams`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": "string",
    "title": "string",
    "sort_order": 0,
    "description": "string"
  }
]
```
</details>

### `responses.api.v1.teams.roles`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": "string",
    "title": "string",
    "color": "string",
    "sort_order": 0
  }
]
```
</details>

### `responses.api.v1.teams.users`

- **Тип:** `array`

### `responses.v1.accounts.users.auth.login`

- **Тип:** `object`

| Поле    | Тип      | Обязательное | Описание | Пример                                                                                                                                                                                                                                                   |
| :------ | :------- | :----------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token` | `string` | Нет          | -        | `"eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="` |

<details><summary>Пример объекта</summary>

```json
{
  "token": "eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="
}
```
</details>

### `responses.v1.accounts.users.auth.logout`

- **Тип:** `object`

| Поле    | Тип    | Обязательное | Описание | Пример   |
| :------ | :----- | :----------- | :------- | :------- |
| `token` | `null` | Нет          | -        | `"null"` |

<details><summary>Пример объекта</summary>

```json
{
  "token": "null"
}
```
</details>

### `responses.v1.accounts.users.auth.social.authenticate`

- **Тип:** `object`

| Поле    | Тип      | Обязательное | Описание              | Пример                                                                                                                                                                                                                                                   |
| :------ | :------- | :----------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token` | `string` | Нет          | JWT токен авторизации | `"eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="` |

<details><summary>Пример объекта</summary>

```json
{
  "token": "eyJpdiI6IjlhZTBTaU9QZ0pUQ0E5YzZzYzhWRWc9PSIsInZhbHVlIjoiSFZaVHF6Sm45UVBCVk13U1hFYWpRdm1IL0xWWTFpTCtKUUpacDhqSk9LZEY1N0R1MURsN3A5VWRvUFp2OU5YYSIsIm1hYyI6IjUyYTM1NmM5ZGNkNGRiOTFiZmM3Y2FhZmY1ZGQ2MTAzOTc4MDNlMGM2MDg1OWNiMjFlODRiNGIyZGRiNTU1YTIifQ=="
}
```
</details>

### `responses.v1.accounts.users.auth.social.login`

- **Тип:** `object`

| Поле    | Тип      | Обязательное | Описание                                                    | Пример                                                                                                                              |
| :------ | :------- | :----------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `url`   | `string` | Нет          | Ссылка на oauth авторизацию через указанную социальную сеть | `"https://oauth.vk.com/authorize?client_id=&redirect_uri=&scope=email&response_type=code&state=9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc"` |
| `state` | `string` | Нет          | Ключ для аутентификации пройденной авторизации              | `"9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc"`                                                                                              |

<details><summary>Пример объекта</summary>

```json
{
  "url": "https://oauth.vk.com/authorize?client_id=&redirect_uri=&scope=email&response_type=code&state=9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc",
  "state": "9xLcqDvd08tTPODsHAXgcidxOvpg3P7Nuc"
}
```
</details>

### `responses.v1.accounts.users.collections.releases`

- **Тип:** `object`

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": "/api/version/path-to-resource?page=1",
        "next": "/api/version/path-to-resource?page=3"
      }
    }
  }
}
```
</details>

### `responses.v1.accounts.users.me.collections.delete`

_Результат удаления релизов из коллекций_

- **Тип:** `array`

### `responses.v1.accounts.users.me.collections.update`

_Результат добавления релизов в коллекции_

- **Тип:** `array`

### `responses.v1.accounts.users.me.favorites.delete`

_Список ID релизов, оставшихся в избранном после удаления_

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[9021, 9022]
```
</details>

### `responses.v1.accounts.users.me.favorites.ids`

_Список ID релизов в избранном_

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[9023, 9024, 9025]
```
</details>

### `responses.v1.accounts.users.me.favorites.ids.item`

- **Тип:** `integer`

### `responses.v1.accounts.users.me.favorites.releases`

- **Тип:** `object`

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": "/api/version/path-to-resource?page=1",
        "next": "/api/version/path-to-resource?page=3"
      }
    }
  }
}
```
</details>

### `responses.v1.accounts.users.me.favorites.update`

_Список ID релизов в избранном_

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[9023, 9024, 9025]
```
</details>

### `responses.v1.accounts.users.me.views.history`

- **Тип:** `object`

| Поле                             | Тип               | Обязательное | Описание | Пример                                   |
| :------------------------------- | :---------------- | :----------- | :------- | :--------------------------------------- |
| `data`                           | array of `object` | Нет          | -        | -                                        |
| `meta`                           | `object`          | Нет          | -        | -                                        |
| `meta.pagination`                | `object`          | Нет          | -        | -                                        |
| `meta.pagination.total`          | `integer`         | Нет          | -        | `"1704"`                                 |
| `meta.pagination.count`          | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.per_page`       | `integer`         | Нет          | -        | `"10"`                                   |
| `meta.pagination.current_page`   | `integer`         | Нет          | -        | `"5"`                                    |
| `meta.pagination.total_pages`    | `integer`         | Нет          | -        | `"171"`                                  |
| `meta.pagination.links`          | `object`          | Нет          | -        | -                                        |
| `meta.pagination.links.previous` | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=1"` |
| `meta.pagination.links.next`     | `string`          | Нет          | -        | `"/api/version/path-to-resource?page=3"` |

<details><summary>Пример объекта</summary>

```json
{
  "data": [{}],
  "meta": {
    "pagination": {
      "total": "1704",
      "count": "10",
      "per_page": "10",
      "current_page": "5",
      "total_pages": "171",
      "links": {
        "previous": "/api/version/path-to-resource?page=1",
        "next": "/api/version/path-to-resource?page=3"
      }
    }
  }
}
```
</details>

### `responses.v1.accounts.users.me.views.timecodes`

- **Тип:** `array`

### `responses.v1.accounts.users.me.views.timecodes.item`

- **Тип:** `object`

### `responses.v1.anime.catalog.references.seasons`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "winter",
    "description": "Зима"
  }
]
```
</details>

### `responses.v1.anime.catalog.references.sorting`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "FRESH_AT_DESC",
    "label": "Самый низкий рейтинг",
    "description": "Сначала отобразятся самые непопулярные релизы"
  }
]
```
</details>

### `responses.v1.anime.catalog.references.types`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "value": "TV",
    "description": "ТВ"
  }
]
```
</details>

### `responses.v1.anime.catalog.references.years`

_Массив годов_

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[2020, 2021, 2022, 2023]
```
</details>

### `responses.v1.anime.franchise`

- **Тип:** `object`

### `responses.v1.anime.franchises`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": "116e17d2-e89f-4ffc-bfa4-b45ae4c41e92",
    "name": "Re: Жизнь в другом мире с нуля",
    "name_english": "Re: Zero kara Hajimeru Isekai Seikatsu",
    "image": {},
    "rating": 8.45,
    "last_year": 2023,
    "first_year": 2010,
    "total_releases": 10,
    "total_episodes": 25,
    "total_duration": "2 дня 5 часов",
    "total_duration_in_seconds": 183600
  }
]
```
</details>

### `responses.v1.anime.franchises.byRelease`

- **Тип:** `array`

### `responses.v1.anime.franchises.random`

- **Тип:** `array`

<details><summary>Пример объекта</summary>

```json
[
  {
    "id": "116e17d2-e89f-4ffc-bfa4-b45ae4c41e92",
    "name": "Re: Жизнь в другом мире с нуля",
    "name_english": "Re: Zero kara Hajimeru Isekai Seikatsu",
    "image": {},
    "rating": 8.45,
    "last_year": 2023,
    "first_year": 2010,
    "total_releases": 10,
    "total_episodes": 25,
    "total_duration": "2 дня 5 часов",
    "total_duration_in_seconds": 183600
  }
]
```
</details>

### `responses.v1.anime.schedule.now`

- **Тип:** `object`

| Поле        | Тип               | Обязательное | Описание | Пример |
| :---------- | :---------------- | :----------- | :------- | :----- |
| `today`     | array of `object` | Нет          | -        | -      |
| `tomorrow`  | array of `object` | Нет          | -        | -      |
| `yesterday` | array of `object` | Нет          | -        | -      |

<details><summary>Пример объекта</summary>

```json
{
  "today": [
    {
      "release": {
        "id": null,
        "type": null,
        "year": null,
        "name": null,
        "alias": null,
        "season": null,
        "poster": null,
        "fresh_at": null,
        "created_at": null,
        "updated_at": null,
        "is_ongoing": null,
        "age_rating": null,
        "publish_day": null,
        "description": null,
        "notification": null,
        "episodes_total": null,
        "external_player": null,
        "is_in_production": null,
        "is_blocked_by_geo": null,
        "is_blocked_by_copyrights": null,
        "added_in_users_favorites": null,
        "average_duration_of_episode": null,
        "added_in_planned_collection": null,
        "added_in_watched_collection": null,
        "added_in_watching_collection": null,
        "added_in_postponed_collection": null,
        "added_in_abandoned_collection": null
      },
      "full_season_is_released": true,
      "published_release_episode": {
        "id": null,
        "name": null,
        "ordinal": null,
        "ending": null,
        "opening": null,
        "preview": null,
        "hls_480": null,
        "hls_720": null,
        "hls_1080": null,
        "duration": null,
        "rutube_id": null,
        "youtube_id": null,
        "updated_at": null,
        "sort_order": null,
        "release_id": null,
        "name_english": null
      },
      "next_release_episode_number": 8
    }
  ],
  "tomorrow": [
    {
      "release": {
        "id": null,
        "type": null,
        "year": null,
        "name": null,
        "alias": null,
        "season": null,
        "poster": null,
        "fresh_at": null,
        "created_at": null,
        "updated_at": null,
        "is_ongoing": null,
        "age_rating": null,
        "publish_day": null,
        "description": null,
        "notification": null,
        "episodes_total": null,
        "external_player": null,
        "is_in_production": null,
        "is_blocked_by_geo": null,
        "is_blocked_by_copyrights": null,
        "added_in_users_favorites": null,
        "average_duration_of_episode": null,
        "added_in_planned_collection": null,
        "added_in_watched_collection": null,
        "added_in_watching_collection": null,
        "added_in_postponed_collection": null,
        "added_in_abandoned_collection": null
      },
      "full_season_is_released": true,
      "published_release_episode": {
        "id": null,
        "name": null,
        "ordinal": null,
        "ending": null,
        "opening": null,
        "preview": null,
        "hls_480": null,
        "hls_720": null,
        "hls_1080": null,
        "duration": null,
        "rutube_id": null,
        "youtube_id": null,
        "updated_at": null,
        "sort_order": null,
        "release_id": null,
        "name_english": null
      },
      "next_release_episode_number": 8
    }
  ],
  "yesterday": [
    {
      "release": {
        "id": null,
        "type": null,
        "year": null,
        "name": null,
        "alias": null,
        "season": null,
        "poster": null,
        "fresh_at": null,
        "created_at": null,
        "updated_at": null,
        "is_ongoing": null,
        "age_rating": null,
        "publish_day": null,
        "description": null,
        "notification": null,
        "episodes_total": null,
        "external_player": null,
        "is_in_production": null,
        "is_blocked_by_geo": null,
        "is_blocked_by_copyrights": null,
        "added_in_users_favorites": null,
        "average_duration_of_episode": null,
        "added_in_planned_collection": null,
        "added_in_watched_collection": null,
        "added_in_watching_collection": null,
        "added_in_postponed_collection": null,
        "added_in_abandoned_collection": null
      },
      "full_season_is_released": true,
      "published_release_episode": {
        "id": null,
        "name": null,
        "ordinal": null,
        "ending": null,
        "opening": null,
        "preview": null,
        "hls_480": null,
        "hls_720": null,
        "hls_1080": null,
        "duration": null,
        "rutube_id": null,
        "youtube_id": null,
        "updated_at": null,
        "sort_order": null,
        "release_id": null,
        "name_english": null
      },
      "next_release_episode_number": 8
    }
  ]
}
```
</details>

### `responses.v1.anime.schedule.week`

- **Тип:** `object`

| Поле   | Тип               | Обязательное | Описание | Пример |
| :----- | :---------------- | :----------- | :------- | :----- |
| `data` | array of `object` | Нет          | -        | -      |

<details><summary>Пример объекта</summary>

```json
{
  "data": [
    {
      "release": {
        "id": null,
        "type": null,
        "year": null,
        "name": null,
        "alias": null,
        "season": null,
        "poster": null,
        "fresh_at": null,
        "created_at": null,
        "updated_at": null,
        "is_ongoing": null,
        "age_rating": null,
        "publish_day": null,
        "description": null,
        "notification": null,
        "episodes_total": null,
        "external_player": null,
        "is_in_production": null,
        "is_blocked_by_geo": null,
        "is_blocked_by_copyrights": null,
        "added_in_users_favorites": null,
        "average_duration_of_episode": null,
        "added_in_planned_collection": null,
        "added_in_watched_collection": null,
        "added_in_watching_collection": null,
        "added_in_postponed_collection": null,
        "added_in_abandoned_collection": null
      },
      "full_season_is_released": true,
      "published_release_episode": {
        "id": null,
        "name": null,
        "ordinal": null,
        "ending": null,
        "opening": null,
        "preview": null,
        "hls_480": null,
        "hls_720": null,
        "hls_1080": null,
        "duration": null,
        "rutube_id": null,
        "youtube_id": null,
        "updated_at": null,
        "sort_order": null,
        "release_id": null,
        "name_english": null
      },
      "next_release_episode_number": 8
    }
  ]
}
```
</details>

### `responses.v1.app.status`

- **Тип:** `object`

| Поле                      | Тип               | Обязательное | Описание | Пример                       |
| :------------------------ | :---------------- | :----------- | :------- | :--------------------------- |
| `request`                 | `object`          | Нет          | -        | -                            |
| `request.ip`              | `string`          | Нет          | -        | `"192.168.1.1"`              |
| `request.country`         | `string`          | Нет          | -        | `"Russia"`                   |
| `request.iso_code`        | `string`          | Нет          | -        | `"RU"`                       |
| `request.timezone`        | `string`          | Нет          | -        | `"Europe/Moscow"`            |
| `is_alive`                | `boolean`         | Нет          | -        | `true`                       |
| `available_api_endpoints` | array of `string` | Нет          | -        | `["https://aniliberty.top"]` |

<details><summary>Пример объекта</summary>

```json
{
  "request": {
    "ip": "192.168.1.1",
    "country": "Russia",
    "iso_code": "RU",
    "timezone": "Europe/Moscow"
  },
  "is_alive": true,
  "available_api_endpoints": ["https://aniliberty.top"]
}
```
</details>

### `responses.v1.media.promotions`

- **Тип:** `object`

| Поле   | Тип               | Обязательное | Описание | Пример |
| :----- | :---------------- | :----------- | :------- | :----- |
| `data` | array of `object` | Нет          | -        | -      |

<details><summary>Пример объекта</summary>

```json
{
  "data": [
    {
      "id": "bad864a4-d1b9-473f-898f-da8ee800ef87",
      "url": "https://espritgames.ru/dragoncontract/promotions/getdragon",
      "url_label": "Перейти на сайт",
      "image": {},
      "title": "Dragon Contract",
      "description": "ИСПЫТАЙ СВОЮ ПАМЯТЬ! Собери все пары карточек правильно, и получи дракона на старте!",
      "is_ad": true,
      "ad_erid": "string",
      "ad_origin": "string",
      "release": {
        "id": null,
        "type": null,
        "year": null,
        "name": null,
        "alias": null,
        "season": null,
        "poster": null,
        "fresh_at": null,
        "created_at": null,
        "updated_at": null,
        "is_ongoing": null,
        "age_rating": null,
        "publish_day": null,
        "description": null,
        "notification": null,
        "episodes_total": null,
        "external_player": null,
        "is_in_production": null,
        "is_blocked_by_geo": null,
        "is_blocked_by_copyrights": null,
        "added_in_users_favorites": null,
        "average_duration_of_episode": null,
        "added_in_planned_collection": null,
        "added_in_watched_collection": null,
        "added_in_watching_collection": null,
        "added_in_postponed_collection": null,
        "added_in_abandoned_collection": null
      },
      "has_overlay": true
    }
  ]
}
```
</details>

### `responses.v1.media.videos`

- **Тип:** `object`

| Поле   | Тип               | Обязательное | Описание | Пример |
| :----- | :---------------- | :----------- | :------- | :----- |
| `data` | array of `object` | Нет          | -        | -      |

<details><summary>Пример объекта</summary>

```json
{
  "data": [{}]
}
```
</details>
