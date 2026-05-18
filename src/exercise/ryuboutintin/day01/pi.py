from __future__ import annotations

import argparse
from decimal import Decimal, getcontext


def calculate_pi(terms: int, digits: int) -> Decimal:
    """Compute pi using the Chudnovsky series."""
    getcontext().prec = digits + 5

    total = Decimal(0)
    for k in range(terms):
        numerator = Decimal(factorial(6 * k)) * (13591409 + 545140134 * k)
        denominator = (
            Decimal(factorial(3 * k))
            * Decimal(factorial(k)) ** 3
            * Decimal(-262537412640768000) ** k
        )
        total += numerator / denominator

    pi = Decimal(426880) * Decimal(10005).sqrt() / total
    return +pi


def factorial(n: int) -> int:
    result = 1
    for value in range(2, n + 1):
        result *= value
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Calculate pi.")
    parser.add_argument(
        "--terms",
        type=int,
        default=5,
        help="Number of Chudnovsky terms to use.",
    )
    parser.add_argument(
        "--digits",
        type=int,
        default=50,
        help="Number of decimal digits to print.",
    )
    args = parser.parse_args()

    if args.terms < 1:
        raise ValueError("--terms must be at least 1")
    if args.digits < 1:
        raise ValueError("--digits must be at least 1")

    pi = calculate_pi(args.terms, args.digits)
    print(f"{pi:.{args.digits}f}")


if __name__ == "__main__":
    main()
