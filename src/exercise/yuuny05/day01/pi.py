from decimal import Decimal, getcontext


def arctan_inverse(x, terms):
    x = Decimal(x)
    total = Decimal(0)
    sign = 1

    for n in range(terms):
        power = 2 * n + 1
        term = Decimal(1) / (power * (x ** power))
        total += term if sign == 1 else -term
        sign *= -1

    return total


def calculate_pi(digits):
    getcontext().prec = digits + 10
    terms = digits * 2

    pi = 16 * arctan_inverse(5, terms) - 4 * arctan_inverse(239, terms)
    return format(+pi, f".{digits}f")


if __name__ == "__main__":
    try:
        raw_digits = input("소수점 아래 몇 자리까지 구할까요? (기본값: 50) ").strip()
    except EOFError:
        raw_digits = ""

    digits = int(raw_digits) if raw_digits else 50

    if digits < 1:
        raise ValueError("자릿수는 1 이상이어야 합니다.")

    print(calculate_pi(digits))
