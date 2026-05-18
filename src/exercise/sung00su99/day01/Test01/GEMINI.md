# Project Overview: Test01 (KOSA Java Exercise)

이 프로젝트는 KOSA 교육 과정의 일환으로 진행되는 Java 기초 실습 과제입니다. `day01`의 첫 번째 테스트 프로젝트로, 기본적인 Java 클래스 구조와 실행 방법을 익히는 것을 목적으로 합니다.

## 핵심 기술 및 아키텍처
- **언어**: Java
- **구조**: 단일 클래스 중심의 간단한 실행 파일 (`Test01.java`)
- **아키텍처**: 별도의 프레임워크 없는 순수 Java 어플리케이션

## 빌드 및 실행 방법

### 1. 컴파일
Java 컴파일러(`javac`)를 사용하여 소스 코드를 바이트코드로 변환합니다.
```bash
javac Test01.java
```

### 2. 실행
생성된 클래스 파일을 Java 가상 머신(JVM)에서 실행합니다.
```bash
java Test01
```

> **TODO**: 현재 환경에서 `javac` 명령어를 찾을 수 없는 경우, JDK(Java Development Kit) 설치 및 PATH 설정이 필요합니다.

## 개발 컨벤션
- **클래스 명명 규칙**: PascalCase를 사용하며 파일명과 일치해야 합니다. (예: `Test01.java` -> `public class Test01`)
- **메서드 명명 규칙**: camelCase를 사용합니다.
- **실습 목적**: 교육 과정의 가이드를 따르며, 코드의 가독성과 기본 문법 준수를 우선시합니다.
