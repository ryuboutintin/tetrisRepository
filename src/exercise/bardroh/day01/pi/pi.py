from decimal import Decimal, getcontext
import argparse


def arctan(x: Decimal) -> Decimal:
    """Calculate arctan(x) using the Taylor series."""
    result = Decimal(0)
    term_power = x
    sign = 1
    n = 1

    while True:
        term = term_power / n
        if term == 0:
            break

        if sign > 0:
            result += term
        else:
            result -= term

        term_power *= x * x
        sign *= -1
        n += 2

    return result


def calculate_pi(digits: int) -> Decimal:
    if digits < 1:
        raise ValueError("digits must be at least 1")

    getcontext().prec = digits + 5
    pi = 16 * arctan(Decimal(1) / 5) - 4 * arctan(Decimal(1) / 239)
    getcontext().prec = digits
    return +pi


def main() -> None:
    parser = argparse.ArgumentParser(description="원주율(pi)을 계산합니다.")
    parser.add_argument(
        "-d",
        "--digits",
        type=int,
        default=50,
        help="계산할 유효 숫자 자리수입니다. 기본값은 50입니다.",
    )
    args = parser.parse_args()

    print(calculate_pi(args.digits))


if __name__ == "__main__":
    main()
