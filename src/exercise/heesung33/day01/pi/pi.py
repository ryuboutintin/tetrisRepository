from decimal import Decimal, getcontext


def arctan_inverse(x: int) -> Decimal:
    """Return arctan(1 / x) using the Gregory series."""
    x_decimal = Decimal(x)
    x_squared = x_decimal * x_decimal
    term = Decimal(1) / x_decimal
    total = term
    sign = -1
    denominator = 3

    while True:
        term /= x_squared
        next_value = term / denominator

        if next_value == 0:
            break

        total += sign * next_value
        sign *= -1
        denominator += 2

    return total


def calculate_pi(digits: int) -> Decimal:
    if digits < 1:
        raise ValueError("digits must be at least 1")

    getcontext().prec = digits + 5
    pi = 16 * arctan_inverse(5) - 4 * arctan_inverse(239)
    getcontext().prec = digits
    return +pi


def main() -> None:
    try:
        digits_text = input("계산할 원주율 자릿수를 입력하세요: ")
        digits = int(digits_text)
        pi = calculate_pi(digits)
    except ValueError as error:
        print(f"입력 오류: {error}")
        return

    print(f"원주율({digits}자리):")
    print(pi)


if __name__ == "__main__":
    main()
