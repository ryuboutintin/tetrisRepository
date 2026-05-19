const themeButton = document.querySelector(".theme-toggle");
const savedTheme = localStorage.getItem("landing-theme");

if (savedTheme === "dark") {
  document.body.classList.add("dark");
  themeButton.textContent = "Light";
}

themeButton.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  themeButton.textContent = isDark ? "Light" : "Dark";
  localStorage.setItem("landing-theme", isDark ? "dark" : "light");
});
