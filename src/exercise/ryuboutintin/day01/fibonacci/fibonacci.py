def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

if __name__ == "__main__":
    n = 100
    result = fibonacci(n)
    print(f"피보나치 수열의 {n}번째 숫자: {result}")
