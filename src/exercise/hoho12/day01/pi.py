def calculate_pi(terms):
    """
    Nilakantha 급수를 사용해 원주율의 근삿값을 계산합니다.
    terms가 클수록 더 정확한 값에 가까워집니다.
    """
    if terms <= 0:
        return 3.0

    pi = 3.0
    sign = 1

    for n in range(1, terms + 1):
        a = 2 * n
        pi += sign * (4 / (a * (a + 1) * (a + 2)))
        sign *= -1

    return pi


if __name__ == "__main__":
    import math
    import sys

    try:
        terms = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
        pi_value = calculate_pi(terms)

        print(f"반복 횟수: {terms}")
        print(f"계산한 원주율: {pi_value}")
        print(f"math.pi와의 차이: {abs(math.pi - pi_value)}")
    except ValueError:
        print("반복 횟수는 정수로 입력해주세요.")
