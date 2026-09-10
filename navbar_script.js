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





window.addEventListener("scroll", () => {

    const scrollTop = window.scrollY;

    const docHeight =
        document.documentElement.scrollHeight -
        window.innerHeight;

    const progress = (scrollTop / docHeight) * 100;

    document.querySelector(".reading-progress-fill").style.height =
        progress + "%";
const progressBar = document.querySelector(".reading-progress");
const hero = document.querySelector(".article-hero");

if (window.scrollY > hero.offsetHeight - 100) {
    progressBar.classList.add("visible");
} else {
    progressBar.classList.remove("visible");
}

});





// =========================
// GEOSCI LOGO
// =========================

const logoLink = document.querySelector(".logo a");
const logoMark = document.querySelector(".logo-mark");

if (logoLink && logoMark) {

    let currentRotation = 0;
    let spinning = false;


    // =========================
    // ENTRANCE ROLL
    // =========================

    const entrance = logoMark.animate(
        [
            {
                transform: "rotate(0deg)"
            },
            {
                transform: "rotate(-360deg)"
            }
        ],
        {
            duration: 2000,
            easing: "cubic-bezier(.76, 0, .24, 1)",
            fill: "forwards"
        }
    );


    entrance.finished.then(() => {

        currentRotation = -360;

        logoMark.style.transform =
            `rotate(${currentRotation}deg)`;

    });


    // =========================
    // HOVER SPIN
    // =========================

    logoLink.addEventListener("mouseenter", () => {

        /*
            Don't start another animation if one
            is already running.
        */

        if (spinning) return;

        spinning = true;


        const startRotation = currentRotation;
        const endRotation = currentRotation - 360;


        const spin = logoMark.animate(
            [
                {
                    transform: `rotate(${startRotation}deg)`
                },
                {
                    transform: `rotate(${endRotation}deg)`
                }
            ],
            {
                duration: 750,
                easing: "cubic-bezier(.76, 0, .24, 1)",
                fill: "forwards"
            }
        );


        spin.finished.then(() => {

            currentRotation = endRotation;

            logoMark.style.transform =
                `rotate(${currentRotation}deg)`;

            spinning = false;

        });

    });

}