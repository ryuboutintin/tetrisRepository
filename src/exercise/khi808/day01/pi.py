from decimal import Decimal, getcontext


def arctan_inverse(x, terms):
    x = Decimal(x)
    x_power = Decimal(1) / x
    total = x_power
    sign = -1

    for n in range(1, terms):
        x_power /= x * x
        total += sign * x_power / (2 * n + 1)
        sign *= -1

    return total


def calculate_pi(digits=50):
    getcontext().prec = digits + 5
    terms = digits * 2

    pi = 16 * arctan_inverse(5, terms) - 4 * arctan_inverse(239, terms)
    return +pi


if __name__ == "__main__":
    digits = 50
    print(calculate_pi(digits))
