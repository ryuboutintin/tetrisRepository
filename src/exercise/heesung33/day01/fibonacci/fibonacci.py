def fibonacci(n):
    """Calculates the n-th Fibonacci number iteratively."""
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
    print(f"The {n}-th Fibonacci number is: {fibonacci(n)}")
