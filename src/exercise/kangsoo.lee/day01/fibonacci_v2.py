def fibonacci_generator(n):
    """피보나치 수열을 n개까지 생성하는 제너레이터"""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

if __name__ == "__main__":
    # 100번째 숫자 계산
    n = 100
    sequence = list(fibonacci_generator(n + 1))
    print(f"{n}번째 피보나치 수: {sequence[n]}")
    
    # 처음 10개 숫자 출력
    print("\n처음 10개의 피보나치 수열:")
    print(list(fibonacci_generator(10)))
