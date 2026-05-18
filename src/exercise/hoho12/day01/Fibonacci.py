def fibonacci(n):
    """
    n개의 피보나치 수열을 생성하여 리스트로 반환합니다.
    """
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence

if __name__ == "__main__":
    import sys
    
    try:
        count = int(sys.argv[1]) if len(sys.argv) > 1 else 10
        print(f"피보나치 수열 ({count}개): {fibonacci(count)}")
    except ValueError:
        print("숫자를 입력해주세요.")
