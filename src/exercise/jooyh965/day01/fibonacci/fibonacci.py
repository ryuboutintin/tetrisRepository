def fibonacci(n):
    """Calculates the n-th Fibonacci number using an iterative approach."""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

if __name__ == "__main__":
    # Calculate 100th Fibonacci number
    n = 100
    result = fibonacci(n)
    print(f"Fibonacci({n}) = {result}")
