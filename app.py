#!/usr/bin/env python3
import io
import os
import sys
import queue
import threading
import traceback
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageOps

# Add current dir to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import card_processor


def make_tk_image(pil_img):
    """
    Safely creates a Tkinter PhotoImage from a PIL Image.
    Features redundant multi-tiered fallbacks:
    1. PIL.ImageTk.PhotoImage (fastest C bridge)
    2. Native Tkinter PNG data buffer (Tk 8.6+ native, bypasses PIL C-extensions)
    3. Native Tkinter PPM data buffer (compatible with all Tk versions)
    """
    try:
        from PIL import ImageTk
        return ImageTk.PhotoImage(pil_img)
    except Exception:
        pass

    try:
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        return tk.PhotoImage(data=buf.getvalue())
    except Exception:
        buf = io.BytesIO()
        conv = pil_img.convert("RGB") if pil_img.mode not in ("RGB", "L") else pil_img
        conv.save(buf, format="PPM")
        return tk.PhotoImage(data=buf.getvalue())


class InteractiveCardCanvas(tk.Frame):
    """
    Canvas that displays a card photo with 4 interactive, draggable corner handles.
    Allows user to fine-tune perspective cropping or auto-detect corners.
    """
    def __init__(self, parent, app, title="Card", is_front=True):
        super().__init__(parent)
        self.app = app
        self.title = title
        self.is_front = is_front
        self.orig_image = None
        self.display_image = None
        self.corners = []  # in original image coordinates [(x, y), ...]
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0
        self.active_handle = None
        self.handle_radius = 9

        # Title & Toolbar
        header = ttk.Frame(self)
        header.pack(fill=tk.X, pady=(0, 4))

        lbl = ttk.Label(header, text=self.title, font=("Helvetica", 10, "bold"))
        lbl.pack(side=tk.LEFT)

        btn_browse = ttk.Button(header, text="Browse...", command=self.browse_image)
        btn_browse.pack(side=tk.RIGHT, padx=1)

        btn_rot = ttk.Button(header, text="Rotate", command=self.rotate_image)
        btn_rot.pack(side=tk.RIGHT, padx=1)

        btn_auto = ttk.Button(header, text="Auto-Detect", command=self.auto_detect)
        btn_auto.pack(side=tk.RIGHT, padx=1)

        btn_card_prev = ttk.Button(header, text="🔍 Clean Card", command=self.preview_card)
        btn_card_prev.pack(side=tk.RIGHT, padx=1)

        # Canvas
        self.canvas_w = 480
        self.canvas_h = 360
        self.canvas = tk.Canvas(
            self,
            width=self.canvas_w,
            height=self.canvas_h,
            bg="#23272e",
            highlightthickness=1,
            highlightbackground="#444851"
        )
        self.canvas.pack(fill=tk.BOTH, expand=True)

        self.canvas.bind("<ButtonPress-1>", self.on_mouse_down)
        self.canvas.bind("<B1-Motion>", self.on_mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_mouse_up)
        self.canvas.bind("<Configure>", self.on_resize)

        self.status_lbl = ttk.Label(self, text="No image loaded — click 'Browse Image...'", font=("Helvetica", 9), foreground="#777")
        self.status_lbl.pack(anchor="w", pady=(3, 0))

    def load_image(self, path_or_img):
        try:
            if isinstance(path_or_img, str):
                if not os.path.exists(path_or_img):
                    messagebox.showerror("File Not Found", f"Cannot find image file:\n{path_or_img}")
                    return
                raw = Image.open(path_or_img)
                self.orig_image = ImageOps.exif_transpose(raw).convert("RGB")
                fname = os.path.basename(path_or_img)
            else:
                self.orig_image = ImageOps.exif_transpose(path_or_img).convert("RGB")
                fname = "Card Image"

            # Auto detect initial corners
            self.corners = card_processor.auto_detect_corners(self.orig_image)
            self.status_lbl.config(
                text=f"{fname} ({self.orig_image.width}×{self.orig_image.height}) — Drag red corners to align card border",
                foreground="#222"
            )
            self.redraw()
        except Exception as e:
            messagebox.showerror("Error Loading Image", f"Failed to load image:\n{e}")

    def browse_image(self):
        filetypes = [
            ("All Supported Images", "*.jpg *.jpeg *.png *.webp *.bmp *.tiff"),
            ("JPEG Images", "*.jpg *.jpeg"),
            ("PNG Images", "*.png"),
            ("All Files", "*.*")
        ]
        path = filedialog.askopenfilename(title=f"Select {self.title}", filetypes=filetypes)
        if path:
            self.load_image(path)

    def rotate_image(self):
        if self.orig_image is None:
            return
        # Rotate 90 degrees clockwise
        self.orig_image = self.orig_image.transpose(Image.Transpose.ROTATE_270)
        self.corners = card_processor.auto_detect_corners(self.orig_image)
        self.redraw()
        self.status_lbl.config(
            text=f"Rotated 90° ({self.orig_image.width}×{self.orig_image.height}) — Drag red corners to align card border"
        )

    def auto_detect(self):
        if self.orig_image is None:
            return
        self.corners = card_processor.auto_detect_corners(self.orig_image)
        self.redraw()

    def on_resize(self, event):
        if event.width > 50 and event.height > 50:
            if event.width != self.canvas_w or event.height != self.canvas_h:
                self.canvas_w = event.width
                self.canvas_h = event.height
                self.redraw()

    def img_to_canvas(self, x, y):
        return x * self.scale + self.offset_x, y * self.scale + self.offset_y

    def canvas_to_img(self, cx, cy):
        ix = (cx - self.offset_x) / max(self.scale, 1e-6)
        iy = (cy - self.offset_y) / max(self.scale, 1e-6)
        ix = max(0, min(self.orig_image.width, ix))
        iy = max(0, min(self.orig_image.height, iy))
        return int(round(ix)), int(round(iy))

    def redraw(self):
        self.canvas.delete("all")
        if self.orig_image is None:
            self.canvas.create_text(
                self.canvas_w // 2,
                self.canvas_h // 2,
                text="Click 'Browse Image...' to load photo\n(or click 'Quick-Load Sample Aadhaar')",
                fill="#888888",
                justify=tk.CENTER,
                font=("Helvetica", 11)
            )
            return

        iw, ih = self.orig_image.size
        if iw <= 0 or ih <= 0:
            return

        # Calculate scale to fit canvas
        self.scale = min(self.canvas_w / iw, self.canvas_h / ih)
        disp_w = max(1, int(iw * self.scale))
        disp_h = max(1, int(ih * self.scale))
        self.offset_x = (self.canvas_w - disp_w) // 2
        self.offset_y = (self.canvas_h - disp_h) // 2

        resized = self.orig_image.resize((disp_w, disp_h), Image.Resampling.BILINEAR)
        self.display_image = make_tk_image(resized)
        self.canvas.create_image(self.offset_x, self.offset_y, image=self.display_image, anchor="nw")

        # Draw polygon connecting corners
        poly_pts = []
        for x, y in self.corners:
            cx, cy = self_pt = self.img_to_canvas(x, y)
            poly_pts.extend(self_pt)

        if len(poly_pts) == 8:
            # Draw semi-transparent outline
            self.canvas.create_polygon(poly_pts, fill="", outline="#00e676", width=2, dash=(6, 4))

        # Draw 4 corner handles
        labels = ["TL", "TR", "BR", "BL"]
        colors = ["#ff1744", "#ff1744", "#ff1744", "#ff1744"]
        for i, (x, y) in enumerate(self.corners):
            cx, cy = self.img_to_canvas(x, y)
            r = self.handle_radius
            # Outer dark ring
            self.canvas.create_oval(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, outline="#000000", width=1)
            # Handle core
            self.canvas.create_oval(cx - r, cy - r, cx + r, cy + r, fill=colors[i], outline="#ffffff", width=2)
            # Label tag background
            tag_text = labels[i]
            self.canvas.create_rectangle(cx - 12, cy - 25, cx + 12, cy - 11, fill="#000000", outline="#ffffff", width=1)
            self.canvas.create_text(cx, cy - 18, text=tag_text, fill="#ffffff", font=("Helvetica", 8, "bold"))

    def on_mouse_down(self, event):
        if self.orig_image is None or not self.corners:
            return
        cx, cy = event.x, event.y
        best_dist = 24.0
        self.active_handle = None
        for i, (x, y) in enumerate(self.corners):
            hx, hy = self.img_to_canvas(x, y)
            d = ((cx - hx) ** 2 + (cy - hy) ** 2) ** 0.5
            if d < best_dist:
                best_dist = d
                self.active_handle = i

    def on_mouse_drag(self, event):
        if self.active_handle is not None and self.orig_image is not None:
            ix, iy = self.canvas_to_img(event.x, event.y)
            self.corners[self.active_handle] = (ix, iy)
            self.redraw()

    def on_mouse_up(self, event):
        self.active_handle = None

    def preview_card(self):
        if self.orig_image is None:
            messagebox.showinfo("No Image", f"Please load an image for {self.title} first.")
            return

        # Snapshot current settings from main thread
        b = float(self.app.scale_bright.get())
        c = float(self.app.scale_contrast.get())
        wb = bool(self.app.var_autowb.get())
        ff = bool(self.app.var_flatfield.get())
        img = self.orig_image
        corners = list(self.corners)
        is_front = self.is_front

        def worker():
            rect = card_processor.rectify_card(img, corners)
            enh = card_processor.enhance_card(
                rect,
                brightness=b,
                contrast=c,
                auto_wb=wb,
                auto_flatfield=ff,
                is_front=is_front
            )
            return enh

        def on_done(enh):
            if enh is None:
                return
            top = tk.Toplevel(self.app)
            top.title(f"Cleaned & Deskewed — {self.title}")
            top.transient(self.app)

            pw = min(780, enh.width)
            ph = int(enh.height * (pw / enh.width))
            resized = enh.resize((pw, ph), Image.Resampling.BILINEAR)
            tk_img = make_tk_image(resized)

            lbl = ttk.Label(top, image=tk_img)
            lbl.image = tk_img
            lbl.pack(padx=15, pady=15)

            lbl_info = ttk.Label(
                top,
                text=f"Card Rectified & Exposure-Corrected ({enh.width}×{enh.height} px, 300 DPI ready)",
                font=("Helvetica", 9),
                foreground="#555"
            )
            lbl_info.pack(pady=(0, 10))

            btn_close = ttk.Button(top, text="Close Preview", command=top.destroy)
            btn_close.pack(pady=(0, 15))
            top.lift()
            top.focus_force()

        self.app.run_async(worker, on_done, busy_msg=f"⏳ Processing {self.title}...")


class IDCardPrinterApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("ID Card Print Utility (Crop, Fix Exposure & Fit to Page)")
        self.geometry("1120x800")
        self.minsize(960, 680)

        # Style
        self.style = ttk.Style()
        self.style.theme_use("clam")

        # Global exception hook to never silently swallow errors
        self.report_callback_exception = self.handle_exception

        # Thread-safe queue for async background worker tasks
        self.queue = queue.Queue()
        self.after(40, self.check_queue)

        self.create_ui()

    def handle_exception(self, exc, val, tb):
        err_msg = "".join(traceback.format_exception(exc, val, tb))
        print("Exception in Tkinter callback:\n", err_msg, file=sys.stderr)
        self.set_busy(False, "❌ Error occurred.")
        messagebox.showerror("Application Error", f"An unexpected error occurred:\n\n{val}")

    def check_queue(self):
        """Polls background worker results and executes UI callbacks on the main thread."""
        try:
            while True:
                msg_type, handler, data = self.queue.get_nowait()
                if msg_type == "success":
                    self.set_busy(False, "Ready.")
                    if handler:
                        handler(data)
                elif msg_type == "error":
                    self.set_busy(False, "❌ Error occurred.")
                    if handler:
                        handler(data)
                    else:
                        messagebox.showerror("Processing Error", f"Error during processing:\n\n{data}")
        except queue.Empty:
            pass
        self.after(40, self.check_queue)

    def create_ui(self):
        # 1. Top Header Banner
        top_frame = ttk.Frame(self, padding=10)
        top_frame.pack(fill=tk.X)

        title_lbl = ttk.Label(
            top_frame,
            text="ID Card Auto-Crop, Exposure Fixer & Print Layout Tool",
            font=("Helvetica", 14, "bold")
        )
        title_lbl.pack(side=tk.LEFT)

        self.btn_clear = ttk.Button(top_frame, text="Clear / New Card", command=self.clear_all)
        self.btn_clear.pack(side=tk.RIGHT, padx=4)

        self.btn_swap = ttk.Button(top_frame, text="⇄ Swap Sides", command=self.swap_sides)
        self.btn_swap.pack(side=tk.RIGHT, padx=4)

        self.btn_sample = ttk.Button(top_frame, text="Quick-Load Sample Aadhaar", command=self.load_samples)
        self.btn_sample.pack(side=tk.RIGHT, padx=4)

        # 2. Main Editors (Side by Side)
        cards_frame = ttk.Frame(self, padding=(10, 0, 10, 5))
        cards_frame.pack(fill=tk.BOTH, expand=True)

        self.front_editor = InteractiveCardCanvas(cards_frame, self, title="Front Side (Photo / Name)", is_front=True)
        self.front_editor.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        self.back_editor = InteractiveCardCanvas(cards_frame, self, title="Back Side (Address)", is_front=False)
        self.back_editor.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))

        # 3. Settings & Options Panel
        ctrl_frame = ttk.LabelFrame(self, text=" Enhancement & Layout Settings ", padding=10)
        ctrl_frame.pack(fill=tk.X, padx=10, pady=5)

        # Row 1: Exposure toggles & sliders
        row1 = ttk.Frame(ctrl_frame)
        row1.pack(fill=tk.X, pady=2)

        self.var_autowb = tk.BooleanVar(value=True)
        cb_wb = ttk.Checkbutton(row1, text="Auto White Balance", variable=self.var_autowb)
        cb_wb.pack(side=tk.LEFT, padx=10)

        self.var_flatfield = tk.BooleanVar(value=True)
        cb_ff = ttk.Checkbutton(row1, text="Flat-Field Illumination (Remove Room Shadows)", variable=self.var_flatfield)
        cb_ff.pack(side=tk.LEFT, padx=10)

        # Brightness slider
        ttk.Label(row1, text="Brightness:").pack(side=tk.LEFT, padx=(20, 5))
        self.scale_bright = ttk.Scale(row1, from_=0.7, to=1.4, value=1.0)
        self.scale_bright.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        # Contrast slider
        ttk.Label(row1, text="Contrast:").pack(side=tk.LEFT, padx=(20, 5))
        self.scale_contrast = ttk.Scale(row1, from_=0.7, to=1.4, value=1.0)
        self.scale_contrast.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        # Row 2: Page Layout choices
        row2 = ttk.Frame(ctrl_frame)
        row2.pack(fill=tk.X, pady=(8, 2))

        ttk.Label(row2, text="Print Layout (Single Page A4):", font=("Helvetica", 10, "bold")).pack(side=tk.LEFT, padx=(5, 15))

        self.var_layout = tk.StringVar(value="document")
        rb1 = ttk.Radiobutton(row2, text="Document / KYC Copy (Large Centered)", variable=self.var_layout, value="document")
        rb1.pack(side=tk.LEFT, padx=10)

        rb2 = ttk.Radiobutton(row2, text="Wallet Card 1:1 Scale (Cut & Fold)", variable=self.var_layout, value="wallet")
        rb2.pack(side=tk.LEFT, padx=10)

        rb3 = ttk.Radiobutton(row2, text="All-In-One Page (Wallet + KYC)", variable=self.var_layout, value="all_in_one")
        rb3.pack(side=tk.LEFT, padx=10)

        # 4. Action Buttons Bar
        self.action_frame = ttk.Frame(self, padding=10)
        self.action_frame.pack(fill=tk.X)

        self.btn_preview = ttk.Button(self.action_frame, text="👁  Preview Print Page", command=self.preview_page)
        self.btn_preview.pack(side=tk.LEFT, padx=5)

        self.btn_pdf = ttk.Button(self.action_frame, text="📄  Export Print-Ready A4 PDF", command=self.save_pdf)
        self.btn_pdf.pack(side=tk.LEFT, padx=5)

        self.btn_pngs = ttk.Button(self.action_frame, text="💾  Save Enhanced PNGs", command=self.save_images)
        self.btn_pngs.pack(side=tk.LEFT, padx=5)

        # Progress bar (Indeterminate animated spinner)
        self.progress_bar = ttk.Progressbar(self.action_frame, mode="indeterminate", length=160)
        self.progress_bar.pack(side=tk.RIGHT, padx=(10, 5))

        self.status_bar = ttk.Label(
            self.action_frame,
            text="Ready. Load Front and Back photos to begin.",
            font=("Helvetica", 10),
            foreground="#2e7d32"
        )
        self.status_bar.pack(side=tk.RIGHT, padx=5)

    def set_busy(self, is_busy, message=""):
        """Controls visual feedback during operations."""
        if is_busy:
            self.config(cursor="watch")
            self.progress_bar.start(10)
            self.btn_preview.config(state=tk.DISABLED)
            self.btn_pdf.config(state=tk.DISABLED)
            self.btn_pngs.config(state=tk.DISABLED)
            self.status_bar.config(text=message, foreground="#c62828")
        else:
            self.config(cursor="")
            self.progress_bar.stop()
            self.btn_preview.config(state=tk.NORMAL)
            self.btn_pdf.config(state=tk.NORMAL)
            self.btn_pngs.config(state=tk.NORMAL)
            self.status_bar.config(text=message, foreground="#2e7d32")
        self.update_idletasks()

    def run_async(self, worker_func, on_success, on_error=None, busy_msg="Processing..."):
        """Runs heavy processing tasks in a background thread and posts results to thread-safe queue."""
        self.set_busy(True, busy_msg)

        def thread_target():
            try:
                result = worker_func()
                self.queue.put(("success", on_success, result))
            except Exception as e:
                self.queue.put(("error", on_error, e))

        thread = threading.Thread(target=thread_target, daemon=True)
        thread.start()

    def load_samples(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        f_sample = os.path.join(base_dir, "samples", "sample_front.jpg")
        b_sample = os.path.join(base_dir, "samples", "sample_back.jpg")

        # Fallback to brain artifacts if samples not found in app dir
        if not os.path.exists(f_sample):
            f_sample = "/home/pnb/.gemini/antigravity/brain/4efdc986-2ea0-4900-ad68-060ee5bf5343/.user_uploaded/media_1789455411590.jpg"
        if not os.path.exists(b_sample):
            b_sample = "/home/pnb/.gemini/antigravity/brain/4efdc986-2ea0-4900-ad68-060ee5bf5343/.user_uploaded/media_1789455411581.jpg"

        if os.path.exists(f_sample):
            self.front_editor.load_image(f_sample)
        if os.path.exists(b_sample):
            self.back_editor.load_image(b_sample)
        self.status_bar.config(text="Sample images loaded. Drag red corner handles to adjust crop if needed.", foreground="#1565c0")

    def swap_sides(self):
        f = self.front_editor
        b = self.back_editor
        f.orig_image, b.orig_image = b.orig_image, f.orig_image
        f.corners, b.corners = b.corners, f.corners
        f_text = f.status_lbl.cget("text")
        b_text = b.status_lbl.cget("text")
        f.status_lbl.config(text=b_text)
        b.status_lbl.config(text=f_text)
        f.redraw()
        b.redraw()
        self.status_bar.config(text="Swapped Front and Back sides.", foreground="#1565c0")

    def clear_all(self):
        self.front_editor.orig_image = None
        self.front_editor.corners = []
        self.front_editor.redraw()
        self.front_editor.status_lbl.config(text="No image loaded — click 'Browse Image...'")

        self.back_editor.orig_image = None
        self.back_editor.corners = []
        self.back_editor.redraw()
        self.back_editor.status_lbl.config(text="No image loaded — click 'Browse Image...'")

        self.status_bar.config(text="Cleared. Ready for new card.", foreground="#2e7d32")

    def get_processing_params(self):
        """Extracts all parameters on the main UI thread to ensure thread safety."""
        if self.front_editor.orig_image is None and self.back_editor.orig_image is None:
            messagebox.showwarning("No Images", "Please load at least one card image (Front or Back).")
            return None

        return {
            "front_img": self.front_editor.orig_image,
            "front_corners": list(self.front_editor.corners),
            "back_img": self.back_editor.orig_image,
            "back_corners": list(self.back_editor.corners),
            "brightness": float(self.scale_bright.get()),
            "contrast": float(self.scale_contrast.get()),
            "autowb": bool(self.var_autowb.get()),
            "flatfield": bool(self.var_flatfield.get()),
            "layout": self.var_layout.get()
        }

    @staticmethod
    def process_cards(params):
        """Worker function executing rectification and enhancement. Thread-safe (pure Python/Pillow/Numpy)."""
        f_img = params["front_img"]
        f_pts = params["front_corners"]
        b_img = params["back_img"]
        b_pts = params["back_corners"]
        b = params["brightness"]
        c = params["contrast"]
        wb = params["autowb"]
        ff = params["flatfield"]

        f_enh = None
        b_enh = None

        if f_img is not None and len(f_pts) >= 4:
            rf = card_processor.rectify_card(f_img, f_pts)
            f_enh = card_processor.enhance_card(rf, brightness=b, contrast=c, auto_wb=wb, auto_flatfield=ff, is_front=True)

        if b_img is not None and len(b_pts) >= 4:
            rb = card_processor.rectify_card(b_img, b_pts)
            b_enh = card_processor.enhance_card(rb, brightness=b, contrast=c, auto_wb=wb, auto_flatfield=ff, is_front=False)

        # Fallback if only one side is loaded: duplicate or placeholder
        if f_enh is None:
            f_enh = b_enh
        if b_enh is None:
            b_enh = f_enh

        return f_enh, b_enh

    def preview_page(self):
        params = self.get_processing_params()
        if params is None:
            return

        def worker():
            f_enh, b_enh = self.process_cards(params)
            return card_processor.generate_a4_page(f_enh, b_enh, layout=params["layout"])

        def on_done(page):
            if page is None:
                return
            self._show_preview_window(page)

        self.run_async(worker, on_done, busy_msg="⏳ Generating A4 Print Preview...")

    def _show_preview_window(self, page):
        # Open preview popup window fitted to user display
        top = tk.Toplevel(self)
        top.title("A4 Print Preview — Single Page Layout")
        top.transient(self)

        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()

        # Fit window within 85% of screen height and 70% width
        dlg_h = min(820, int(screen_h * 0.85))
        dlg_w = min(720, int(screen_w * 0.70))
        top.geometry(f"{dlg_w}x{dlg_h}")

        # Top control bar in preview window
        tb = ttk.Frame(top, padding=8)
        tb.pack(fill=tk.X)

        layout_name = {
            "document": "Document / KYC Copy (Large Centered)",
            "wallet": "Wallet Card 1:1 Scale (Cut & Fold)",
            "all_in_one": "All-In-One Page (Wallet + KYC)"
        }.get(self.var_layout.get(), "Document")

        ttk.Label(tb, text=f"Layout: {layout_name}", font=("Helvetica", 10, "bold")).pack(side=tk.LEFT, padx=5)

        btn_save = ttk.Button(tb, text="📄 Export PDF Now...", command=lambda: [top.destroy(), self.save_pdf()])
        btn_save.pack(side=tk.RIGHT, padx=5)

        btn_close = ttk.Button(tb, text="Close", command=top.destroy)
        btn_close.pack(side=tk.RIGHT, padx=5)

        # Image preview canvas
        preview_h = max(200, dlg_h - 70)
        preview_w = int(page.width * (preview_h / page.height))
        preview_img = page.resize((preview_w, preview_h), Image.Resampling.BILINEAR)
        tk_img = make_tk_image(preview_img)

        lbl = ttk.Label(top, image=tk_img)
        lbl.image = tk_img
        lbl.pack(pady=5, expand=True)

        self.status_bar.config(text="✅ Print preview generated.", foreground="#2e7d32")
        top.lift()
        top.focus_force()

    def save_pdf(self):
        params = self.get_processing_params()
        if params is None:
            return

        path = filedialog.asksaveasfilename(
            title="Save Print-Ready A4 PDF",
            defaultextension=".pdf",
            filetypes=[("PDF Document", "*.pdf")]
        )
        if not path:
            return

        def worker():
            f_enh, b_enh = self.process_cards(params)
            page = card_processor.generate_a4_page(f_enh, b_enh, layout=params["layout"])
            page.save(path, "PDF", resolution=300.0)
            return path

        def on_done(saved_path):
            if saved_path:
                self.status_bar.config(text=f"✅ PDF saved: {os.path.basename(saved_path)}", foreground="#2e7d32")
                messagebox.showinfo("Success", f"Print-ready A4 PDF saved successfully:\n{saved_path}")

        self.run_async(worker, on_done, busy_msg="⏳ Generating & Saving A4 PDF (300 DPI)...")

    def save_images(self):
        params = self.get_processing_params()
        if params is None:
            return

        folder = filedialog.askdirectory(title="Select Folder to Save Enhanced Images")
        if not folder:
            return

        def worker():
            f_enh, b_enh = self.process_cards(params)
            f_path = os.path.join(folder, "id_front_enhanced.png")
            b_path = os.path.join(folder, "id_back_enhanced.png")
            f_enh.save(f_path)
            b_enh.save(b_path)
            return folder

        def on_done(saved_folder):
            if saved_folder:
                self.status_bar.config(text=f"✅ Images saved in: {saved_folder}", foreground="#2e7d32")
                messagebox.showinfo("Success", f"Enhanced PNG cards saved in:\n{saved_folder}\n- id_front_enhanced.png\n- id_back_enhanced.png")

        self.run_async(worker, on_done, busy_msg="⏳ Enhancing & Saving PNG Cards...")


if __name__ == "__main__":
    app = IDCardPrinterApp()
    app.mainloop()
