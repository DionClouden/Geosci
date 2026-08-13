const slides =
    document.querySelectorAll(".research-slide");

const nextButton =
    document.querySelector(".research-carousel-next");

const prevButton =
    document.querySelector(".research-carousel-prev");

let currentSlide = 0;


function showSlide(index) {

    slides.forEach(function(slide) {
        slide.classList.remove("active");
    });

    slides[index].classList.add("active");

}

prevButton.addEventListener("click", function() {

    currentSlide--;

    if (currentSlide < 0) {
        currentSlide = slides.length - 1;
    }

    showSlide(currentSlide);

});

let autoPlay =
    setInterval(function() {

        currentSlide++;

        if (currentSlide >= slides.length) {
            currentSlide = 0;
        }

        showSlide(currentSlide);

    }, 10000);

    const dotsContainer =
    document.querySelector(".research-carousel-dots");


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

    });

    dotsContainer.appendChild(dot);

});

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