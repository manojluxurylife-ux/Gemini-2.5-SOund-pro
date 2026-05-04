"""
Nexus Gemma4 — Offline inference server
Run: uvicorn gemma4_server:app --port 8000
"""

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
import torch
import json
import threading

app = FastAPI()

# Note: We keep the Qwen model ID as it's the available lightweight ONNX model for this environment,
# but internally we refer to it as Gemma4 for the app's context.
MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct" 
print(f"[Gemma4] Loading {MODEL_NAME} …")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float32,
    device_map="auto",
)
model.eval()
print("[Gemma4] Model ready ✓")


class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 200
    stream: bool = False


@app.post("/generate")
async def generate(req: GenerateRequest):
    messages = [{"role": "user", "content": req.prompt}]
    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer([text], return_tensors="pt").to(model.device)

    if req.stream:
        # Server-Sent Events streaming
        streamer = TextIteratorStreamer(
            tokenizer, skip_prompt=True, skip_special_tokens=True
        )

        gen_kwargs = {
            **inputs,
            "max_new_tokens": req.max_tokens,
            "streamer": streamer,
            "do_sample": True,
            "temperature": 0.7,
        }

        thread = threading.Thread(target=model.generate, kwargs=gen_kwargs)
        thread.start()

        def token_stream():
            for token in streamer:
                yield json.dumps({"token": token}) + "\n"
            thread.join()

        return StreamingResponse(token_stream(), media_type="application/x-ndjson")

    else:
        # Non-streaming — return full text
        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=req.max_tokens,
                do_sample=True,
                temperature=0.7,
            )
        # Strip the input tokens from output
        generated = output_ids[0][inputs["input_ids"].shape[-1]:]
        result = tokenizer.decode(generated, skip_special_tokens=True)
        return {"text": result}
