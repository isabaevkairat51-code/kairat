
import re

ONES = [
    "нөл", "бир", "эки", "үч", "төрт",
    "беш", "алты", "жети", "сегиз", "тогуз"
]

TENS = {
    10: "он",
    20: "жыйырма",
    30: "отуз",
    40: "кырк",
    50: "элүү",
    60: "алтымыш",
    70: "жетимиш",
    80: "сексен",
    90: "токсон"
}


def number_to_ky(number: int) -> str:
    """Целое число -> кыргызские слова."""

    if number < 0:
        return "минус " + number_to_ky(-number)

    if number < 10:
        return ONES[number]

    if number < 100:
        tens = (number // 10) * 10
        rest = number % 10

        if rest == 0:
            return TENS[tens]

        return TENS[tens] + " " + ONES[rest]

    if number < 1000:
        hundreds = number // 100
        rest = number % 100

        # 100 — жүз, 200 — эки жүз и т. д.
        if hundreds == 1:
            result = "жүз"
        else:
            result = ONES[hundreds] + " жүз"

        if rest:
            result += " " + number_to_ky(rest)

        return result

    if number < 1_000_000:
        thousands = number // 1000
        rest = number % 1000

        if thousands == 1:
            result = "миң"
        else:
            result = number_to_ky(thousands) + " миң"

        if rest:
            result += " " + number_to_ky(rest)

        return result

    # Слишком большие числа оставляем без преобразования.
    return str(number)


def normalize_ky_text(text: str) -> str:
    # Сохраняем кыргызские буквы, не транслитерируем их.
    text = text.lower()

    # Заменяем целые числа словами.
    text = re.sub(
        r"(?<!\w)\d+(?!\w)",
        lambda match: number_to_ky(int(match.group())),
        text
    )

    # Удаляем символы, не относящиеся к тексту и пунктуации.
    text = re.sub(
        r"[^а-яёңөүһүъьa-z0-9\s.,!?;:()\-]",
        " ",
        text
    )

    # Нормализуем пробелы.
    text = re.sub(r"\s+", " ", text).strip()

    return text


if __name__ == "__main__":
    sample = "Салам! 2026-жылы 125 студент окуйт."
    print(normalize_ky_text(sample))
