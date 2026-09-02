/* =========================
   RESEARCH CAROUSEL
========================= */

const slides =
    document.querySelectorAll(".research-slide");

const dotsContainer =
    document.querySelector(".research-carousel-dots");

let currentSlide = 0;


/* CREATE DOTS */

slides.forEach(function(slide, index) {

    const dot =
        document.createElement("button");

    dot.classList.add("research-dot");

    if (index === 0) {
        dot.classList.add("active");
    }

    dot.addEventListener("click", function() {

        currentSlide = index;

        showSlide(currentSlide);

        resetAutoPlay();

    });

    dotsContainer.appendChild(dot);

});


/* SHOW SLIDE */

function showSlide(index) {

    slides.forEach(function(slide) {
        slide.classList.remove("active");
    });

    document
        .querySelectorAll(".research-dot")
        .forEach(function(dot) {
            dot.classList.remove("active");
        });

    slides[index].classList.add("active");

    document
        .querySelectorAll(".research-dot")[index]
        .classList.add("active");

}


/* AUTOPLAY */

let autoPlay =
    setInterval(function() {

        currentSlide++;

        if (currentSlide >= slides.length) {
            currentSlide = 0;
        }

        showSlide(currentSlide);

    }, 10000);


/* RESET AUTOPLAY AFTER DOT CLICK */

function resetAutoPlay() {

    clearInterval(autoPlay);

    autoPlay =
        setInterval(function() {

            currentSlide++;

            if (currentSlide >= slides.length) {
                currentSlide = 0;
            }

            showSlide(currentSlide);

        }, 10000);

}


/* =========================
   RESEARCH INDEX ALPHABET
========================= */

const alphabetButtons =
    document.querySelectorAll(
        ".research-alphabet button[data-target]"
    );

alphabetButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        const targetId =
            this.dataset.target;

        const target =
            document.getElementById(targetId);

        if (!target) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    });

});

const researchIndex =
    document.querySelector(".research-index");

const researchTopBlur =
    document.querySelector(".research-top-blur");


window.addEventListener("scroll", function() {

    if (!researchIndex || !researchTopBlur) return;

    const indexTop =
        researchIndex.getBoundingClientRect().top;

    if (indexTop <= 0) {
        researchTopBlur.classList.add("visible");
    } else {
        researchTopBlur.classList.remove("visible");
    }

});