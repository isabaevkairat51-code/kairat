
import gradio as gr
import tempfile

from kyrgyz_tts_mini.engine import get_tts
from kyrgyz_tts_mini.config import Settings
from text_processor import normalize_ky_text


# ==============================
# TTS МОДЕЛЬ
# ==============================

tts = get_tts()


def generate_audio(text, voice, speed, temperature, steps, denoise):

    if not text or not text.strip():
        raise gr.Error("Кыргызча текст киргизиңиз!")

    try:
        clean_text = normalize_ky_text(text)

        settings = Settings(
            temperature=float(temperature),
            rate=1.0 / float(speed),
            steps=int(steps),
            denoise=float(denoise)
        )

        speech = tts.synthesize(
            clean_text,
            voice=voice,
            settings=settings
        )

        with tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False
        ) as file:
            audio_path = file.name

        speech.save(audio_path)

        return audio_path, clean_text

    except gr.Error:
        raise

    except Exception as error:
        raise gr.Error(f"Ката кетти: {error}")


def sample_text():
    return (
        "Саламатсызбы! Кыргыз тилинде сүйлөгөн "
        "синтезаторду сынап жатабыз. "
        "Биздин максат — кыргыз тилин технология аркылуу өнүктүрүү."
    )


def clear_text():
    return "", None, ""


# ==============================
# CSS DESIGN
# ==============================

css = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

* {
    font-family: 'Inter', sans-serif !important;
}

body {
    background: #090914 !important;
}

.gradio-container {
    max-width: 1250px !important;
    margin: auto !important;
    background:
        radial-gradient(ellipse at 10% 0%, #27205a 0%, transparent 35%),
        radial-gradient(ellipse at 90% 15%, #32143e 0%, transparent 30%),
        #090914 !important;
    color: #f5f3ff !important;
}

#hero {
    position: relative;
    text-align: center;
    padding: 55px 20px 35px;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 28px;
    background: linear-gradient(
        135deg,
        rgba(110,75,255,.20),
        rgba(20,20,45,.75),
        rgba(0,210,255,.08)
    );
    margin-bottom: 24px;
    overflow: hidden;
}

#hero h1 {
    font-size: clamp(34px, 5vw, 58px);
    font-weight: 900;
    letter-spacing: -2px;
    color: white;
    margin-bottom: 12px;
}

.gradient-text {
    background: linear-gradient(90deg, #a78bfa, #60d8ff, #ec8cff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

#hero p {
    color: #aaa8c5;
    font-size: 16px;
}

.hero-label {
    display: inline-block;
    color: #c7baff;
    background: rgba(139,92,246,.15);
    border: 1px solid rgba(167,139,250,.3);
    padding: 8px 16px;
    border-radius: 30px;
    font-size: 12px;
    margin-bottom: 18px;
}

.panel {
    background: rgba(20,20,42,.85) !important;
    border: 1px solid rgba(255,255,255,.09) !important;
    border-radius: 22px !important;
    padding: 22px !important;
    box-shadow: 0 15px 45px rgba(0,0,0,.16);
}

.panel-title {
    font-size: 20px;
    font-weight: 800;
    color: white;
    margin-bottom: 15px;
}

textarea, input {
    background: #111126 !important;
    color: white !important;
    border: 1px solid #343354 !important;
    border-radius: 14px !important;
}

textarea:focus {
    border-color: #9673ff !important;
}

label {
    color: #c8c5e0 !important;
}

button {
    border-radius: 12px !important;
    transition: .2s ease !important;
}

button.primary {
    background: linear-gradient(100deg, #7654ed, #a64de5) !important;
    border: none !important;
    color: white !important;
    font-weight: 800 !important;
    min-height: 55px !important;
    box-shadow: 0 7px 25px rgba(132,83,255,.25);
}

button.primary:hover {
    filter: brightness(1.15);
    transform: translateY(-2px);
}

.secondary-btn {
    border: 1px solid #454064 !important;
}

.output-panel {
    background: linear-gradient(
        145deg,
        rgba(39,31,76,.8),
        rgba(17,17,38,.95)
    ) !important;
    border: 1px solid rgba(167,139,250,.2) !important;
    border-radius: 22px !important;
    padding: 22px !important;
}

footer {
    display: none !important;
}

#footer {
    text-align: center;
    color: #77758f;
    padding: 28px 10px;
    font-size: 12px;
}

@media(max-width: 700px) {
    #hero {
        padding: 35px 15px;
    }

    #hero h1 {
        letter-spacing: -1px;
    }

    .panel, .output-panel {
        padding: 15px !important;
    }
}
"""


# ==============================
# INTERFACE
# ==============================

with gr.Blocks(title="Үн дүйнөсү") as demo:

    gr.HTML("""
    <div id="hero">
        <div class="hero-label">✦ KYRGYZ TEXT TO SPEECH</div>
        <h1>Үн <span class="gradient-text">дүйнөсү</span></h1>
        <p>Кыргызча текстти жандуу үнгө айлантыңыз</p>
    </div>
    """)

    with gr.Row():

        # LEFT SIDE
        with gr.Column(scale=6):

            with gr.Group(elem_classes="panel"):

                gr.HTML(
                    '<div class="panel-title">✍️ Текст киргизүү</div>'
                )

                text_input = gr.Textbox(
                    placeholder="Бул жерге кыргызча текст жазыңыз...",
                    lines=9,
                    show_label=False
                )

                with gr.Row():
                    sample_btn = gr.Button(
                        "✦ Мисал текст",
                        elem_classes="secondary-btn"
                    )

                    clear_btn = gr.Button(
                        "⌫ Тазалоо",
                        elem_classes="secondary-btn"
                    )

            with gr.Group(elem_classes="panel"):

                gr.HTML(
                    '<div class="panel-title">🎙️ Үн жөндөөлөрү</div>'
                )

                voice = gr.Radio(
                    choices=[
                        ("👩 Аялдын үнү", "woman"),
                        ("👨 Эркектин үнү", "man")
                    ],
                    value="woman",
                    label="Үн тандоо"
                )

                speed = gr.Slider(
                    minimum=0.5,
                    maximum=2.0,
                    value=1.0,
                    step=0.1,
                    label="⚡ Сүйлөө ылдамдыгы"
                )

                temperature = gr.Slider(
                    minimum=0.1,
                    maximum=1.0,
                    value=0.667,
                    step=0.01,
                    label="🎚️ Үндүн өзгөрмөлүүлүгү"
                )

                with gr.Accordion(
                    "⚙️ Кошумча жөндөөлөр",
                    open=False
                ):

                    steps = gr.Slider(
                        10, 40, value=10, step=1,
                        label="Модель кадамдары"
                    )

                    denoise = gr.Slider(
                        0.0, 0.001,
                        value=0.00025,
                        step=0.00001,
                        label="Ызы-чууну азайтуу"
                    )

            generate_btn = gr.Button(
                "✦ ҮН ТҮЗҮҮ",
                variant="primary",
                size="lg"
            )

        # RIGHT SIDE
        with gr.Column(scale=5):

            with gr.Group(elem_classes="output-panel"):

                gr.HTML("""
                <div class="panel-title">
                    🎧 Сиздин аудио
                </div>
                <p style="color:#9995b8;font-size:13px">
                    Даяр болгон кыргызча үндү бул жерден угуңуз
                </p>
                """)

                audio_output = gr.Audio(
                    label="Даяр үн",
                    type="filepath"
                )

                clean_output = gr.Textbox(
                    label="Иштетилген текст",
                    lines=6,
                    interactive=False
                )

                gr.Markdown(
                    """
                    **💡 Кеңеш**

                    Текстти так жана туура жазыңыз.
                    Ң, Ө, Ү тамгаларын колдонсоңуз болот.
                    """
                )

    gr.HTML("""
    <div id="footer">
        ҮН ДҮЙНӨСҮ · KYRGYZ AI VOICE PROJECT<br>
        Кыргыз тили үчүн технология
    </div>
    """)

    generate_btn.click(
        fn=generate_audio,
        inputs=[
            text_input,
            voice,
            speed,
            temperature,
            steps,
            denoise
        ],
        outputs=[
            audio_output,
            clean_output
        ]
    )

    sample_btn.click(
        fn=sample_text,
        outputs=text_input
    )

    clear_btn.click(
        fn=clear_text,
        outputs=[
            text_input,
            audio_output,
            clean_output
        ]
    )


# ==============================
# START
# ==============================

demo.launch(
    theme=gr.themes.Base(),
    css=css,
    server_name="127.0.0.1",
    server_port=7861
)   
