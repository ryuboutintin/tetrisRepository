def fibonacci(n):
    """
    Calculates the n-th Fibonacci number.
    F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2)
    """
    if n < 0:
        raise ValueError("n must be a non-negative integer")
    if n == 0:
        return 0
    if n == 1:
        return 1
    
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

if __name__ == "__main__":
    n = 100
    print(f"The {n}-th Fibonacci number is: {fibonacci(n)}")
