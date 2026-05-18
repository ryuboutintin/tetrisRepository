import argparse


def calculate_pi(iterations):
    pi = 0.0
    sign = 1

    for i in range(iterations):
        pi += sign * 4 / (2 * i + 1)
        sign *= -1

    return pi


def main():
    parser = argparse.ArgumentParser(description="Calculate pi using the Leibniz series.")
    parser.add_argument(
        "iterations",
        nargs="?",
        type=int,
        default=1_000_000,
        help="number of iterations to use",
    )
    args = parser.parse_args()

    if args.iterations <= 0:
        raise ValueError("iterations must be greater than 0")

    pi = calculate_pi(args.iterations)
    print(f"iterations: {args.iterations}")
    print(f"pi: {pi}")


if __name__ == "__main__":
    main()
