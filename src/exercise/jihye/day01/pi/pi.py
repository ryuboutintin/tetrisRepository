import sys


def calculate_pi(iterations=100000):
    """
    Approximate pi using the Nilakantha series.

    pi = 3 + 4/(2*3*4) - 4/(4*5*6) + 4/(6*7*8) - ...
    """
    pi_value = 3.0
    sign = 1
    a = 2

    for _ in range(iterations):
        pi_value += sign * (4.0 / (a * (a + 1) * (a + 2)))
        sign *= -1
        a += 2

    return pi_value


if __name__ == "__main__":
    iterations = 100000

    if len(sys.argv) > 1:
        iterations = int(sys.argv[1])

    result = calculate_pi(iterations)
    print(f"pi ≈ {result}")
