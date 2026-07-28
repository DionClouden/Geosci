const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {

    if (window.scrollY > 150) {
        navbar.classList.add("scrolled");
    }

    if (window.scrollY < 80) {
        navbar.classList.remove("scrolled");
    }

});





const observer = new IntersectionObserver((entries) => {

    entries.forEach((entry) => {

        if (entry.isIntersecting) {

            entry.target.classList.add("show");

        }

    });

});


document.querySelectorAll(".hidden").forEach((element) => {

    observer.observe(element);

});

const counters = document.querySelectorAll(".counter");


const counterObserver = new IntersectionObserver((entries) => {

    entries.forEach((entry) => {

        if (entry.isIntersecting) {

            const counter = entry.target;

            const target = Number(counter.dataset.target);

            let current = 0;

            const increment = target / 80;


            const updateCounter = () => {

                current += increment;


                if (current < target) {

                    counter.textContent = counter.classList.contains("decimal")
    ? current.toFixed(1)
    : Math.floor(current);

                    requestAnimationFrame(updateCounter);

                } else {

                    counter.textContent = target;

                }

            };


            updateCounter();

            counterObserver.unobserve(counter);

        }

    });

});


counters.forEach(counter => {

    counterObserver.observe(counter);

});