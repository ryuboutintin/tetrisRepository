from decimal import Decimal, getcontext


def calculate_pi(digits):
    """Calculate pi to the requested number of decimal digits."""
    if digits < 1:
        raise ValueError("digits must be at least 1")

    getcontext().prec = digits + 5

    c = 426880 * Decimal(10005).sqrt()
    total = Decimal(0)
    k = 0

    while True:
        numerator = Decimal((-1) ** k) * factorial(6 * k) * (13591409 + 545140134 * k)
        denominator = factorial(3 * k) * (factorial(k) ** 3) * (640320 ** (3 * k))
        term = numerator / denominator
        total += term

        if abs(term) < Decimal(10) ** (-(digits + 2)):
            break

        k += 1

    pi = c / total
    getcontext().prec = digits
    return +pi


def factorial(n):
    result = 1
    for number in range(2, n + 1):
        result *= number
    return result


def main():
    try:
        digits = int(input("How many digits of pi do you want? "))
        print(calculate_pi(digits))
    except ValueError as error:
        print(f"Invalid input: {error}")


if __name__ == "__main__":
    main()
