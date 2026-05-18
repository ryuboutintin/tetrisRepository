from decimal import Decimal, getcontext


def arctan_inverse(x: int, terms: int) -> Decimal:
    """Calculate arctan(1 / x) using a Taylor series."""
    x = Decimal(x)
    x_squared = x * x
    term = Decimal(1) / x
    total = term

    for n in range(1, terms):
        term /= x_squared
        if n % 2 == 0:
            total += term / (2 * n + 1)
        else:
            total -= term / (2 * n + 1)

    return total


def calculate_pi(digits: int) -> Decimal:
    getcontext().prec = digits + 5
    terms = max(10, digits * 2)

    pi = 16 * arctan_inverse(5, terms) - 4 * arctan_inverse(239, terms)
    getcontext().prec = digits
    return +pi


def main() -> None:
    digits_text = input("계산할 원주율 자릿수를 입력하세요: ").strip()

    if not digits_text.isdigit() or int(digits_text) <= 0:
        print("1 이상의 정수를 입력하세요.")
        return

    digits = int(digits_text)
    pi = calculate_pi(digits)

    print(f"원주율 근삿값 ({digits}자리):")
    print(pi)


if __name__ == "__main__":
    main()
