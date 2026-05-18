todos = []

def add(title):
    todos.append({"id": len(todos) + 1, "title": title, "done": False})
    print(f"추가됨: {title}")

def complete(todo_id):
    for todo in todos:
        if todo["id"] == todo_id:
            todo["done"] = True
            print(f"완료됨: {todo['title']}")
            return
    print(f"ID {todo_id} 를 찾을 수 없습니다.")

def delete(todo_id):
    global todos
    before = len(todos)
    todos = [t for t in todos if t["id"] != todo_id]
    if len(todos) < before:
        print(f"ID {todo_id} 삭제됨")
    else:
        print(f"ID {todo_id} 를 찾을 수 없습니다.")

def show():
    if not todos:
        print("할 일이 없습니다.")
        return
    print("\n=== 할 일 목록 ===")
    for t in todos:
        status = "✔" if t["done"] else "○"
        print(f"  [{status}] {t['id']}. {t['title']}")
    print()

if __name__ == "__main__":
    add("파이썬 공부하기")
    add("운동하기")
    add("책 읽기")
    show()

    complete(1)
    delete(2)
    show()
