# GitHub Pages 배포 방법

## 1. GitHub 개인 퍼블릭 레포지토리 생성

1. [github.com](https://github.com) 로그인
2. 우측 상단 `+` → **New repository** 클릭
3. 설정:
   - **Repository name**: `tetris` (원하는 이름)
   - **Visibility**: `Public` 선택
   - **Initialize this repository with a README**: 체크 해제
4. **Create repository** 클릭

## 2. 로컬 코드를 새 레포에 올리기

```bash
# 현재 tetris 디렉터리로 이동
cd src/exercise/kangsoo.lee/day02/tetris

# 새 git 레포 초기화
git init

# 파일 추가 및 첫 커밋
git add index.html
git commit -m "Initial commit: Tetris game"

# GitHub 레포를 원격으로 등록 (본인 username/repo명으로 변경)
git remote add origin https://github.com/<username>/tetris.git

# main 브랜치로 push
git branch -M main
git push -u origin main
```

## 3. GitHub Pages 활성화

1. 레포 페이지에서 **Settings** 탭 클릭
2. 좌측 메뉴 **Pages** 클릭
3. **Branch** 항목에서 `main` 선택, 폴더는 `/ (root)` 선택
4. **Save** 클릭
5. 잠시 후 상단에 배포 URL 표시됨:
   ```
   https://<username>.github.io/tetris/
   ```

## 4. 이후 업데이트 반영

코드를 수정한 뒤 push하면 자동으로 재배포됩니다.

```bash
git add index.html
git commit -m "업데이트 내용"
git push origin main
```

> GitHub Pages 반영까지 보통 1~2분 소요됩니다.
