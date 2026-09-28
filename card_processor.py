import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageDraw, ImageFont

def auto_detect_corners(im):
    """
    Attempts to detect the card boundary in the image.
    Falls back to a centered rectangle if edges are ambiguous.
    Returns: [TL, TR, BR, BL] in image coordinates [(x, y), ...]
    """
    w, h = im.size
    gray = np.array(im.convert("L"), dtype=float)

    # Search for sharp transitions / border lines in each quadrant
    # Default fallback: 10% inset
    default_tl = (int(0.12 * w), int(0.15 * h))
    default_tr = (int(0.88 * w), int(0.15 * h))
    default_br = (int(0.88 * w), int(0.85 * h))
    default_bl = (int(0.12 * w), int(0.85 * h))

    try:
        # Check if there are distinct horizontal and vertical dark border lines
        # In typical card photos, card is inside [0.1..0.9] of width and [0.2..0.85] of height
        mid_x = w // 2
        mid_y = h // 2
        
        # Scan vertical profile in middle
        col = gray[:, mid_x]
        grad_y = np.abs(np.diff(col))
        
        # Candidate top: peak gradient in top half
        top_cands = np.where(grad_y[int(0.2*h):int(0.55*h)] > 15)[0]
        bot_cands = np.where(grad_y[int(0.6*h):int(0.88*h)] > 15)[0]
        
        # Scan horizontal profile in middle
        row = gray[mid_y, :]
        grad_x = np.abs(np.diff(row))
        left_cands = np.where(grad_x[int(0.08*w):int(0.35*w)] > 15)[0]
        right_cands = np.where(grad_x[int(0.65*w):int(0.92*w)] > 15)[0]

        if len(top_cands) > 0 and len(bot_cands) > 0 and len(left_cands) > 0 and len(right_cands) > 0:
            y_top = int(0.2 * h) + top_cands[0]
            y_bot = int(0.6 * h) + bot_cands[-1]
            x_left = int(0.08 * w) + left_cands[0]
            x_right = int(0.65 * w) + right_cands[-1]
            
            # Sanity check aspect ratio
            bw = x_right - x_left
            bh = y_bot - y_top
            if 1.2 <= (bw / max(bh, 1)) <= 1.8 and bw > 0.3 * w and bh > 0.2 * h:
                return [(int(x_left), int(y_top)), (int(x_right), int(y_top)), (int(x_right), int(y_bot)), (int(x_left), int(y_bot))]
    except Exception:
        pass

    return [(int(x), int(y)) for x, y in [default_tl, default_tr, default_br, default_bl]]


def rectify_card(im, corners, target_w=1184, target_h=758):
    """
    Rectifies perspective given corners: [TL, TR, BR, BL].
    PIL QUAD expects (TL_x, TL_y, BL_x, BL_y, BR_x, BR_y, TR_x, TR_y)
    """
    tl, tr, br, bl = corners
    
    if target_w is None or target_h is None:
        width_top = np.hypot(tr[0] - tl[0], tr[1] - tl[1])
        width_bot = np.hypot(br[0] - bl[0], br[1] - bl[1])
        target_w = int(max(width_top, width_bot))
        
        height_left = np.hypot(bl[0] - tl[0], bl[1] - tl[1])
        height_right = np.hypot(br[0] - tr[0], br[1] - tr[1])
        target_h = int(max(height_left, height_right))

    quad_data = (tl[0], tl[1], bl[0], bl[1], br[0], br[1], tr[0], tr[1])
    warped = im.transform(
        (target_w, target_h),
        Image.Transform.QUAD,
        data=quad_data,
        resample=Image.Resampling.BICUBIC
    )
    return warped


def enhance_card(img, brightness=1.0, contrast=1.0, auto_wb=True, auto_flatfield=True, is_front=False):
    """
    Professional tone mapping for document photos:
    - Neutralizes lighting color cast
    - Flat-fields illumination gradient
    - Smooth S-curve to whiten background and darken text
    - Preserves photo details and colors
    """
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape

    # 1. Auto White Balance
    if auto_wb:
        # Sample paper region (avoid photo area on front: photo is on left middle)
        if is_front:
            sample_patch = arr[int(0.1*h):int(0.25*h), int(0.4*w):int(0.8*w)]
        else:
            sample_patch = arr[int(0.4*h):int(0.65*h), int(0.3*w):int(0.7*w)]
            
        sample = sample_patch.mean(axis=(0, 1))
        target_val = np.max(sample)
        if target_val > 10:
            wb_gains = target_val / np.maximum(sample, 1.0)
            for c in range(3):
                arr[:, :, c] *= wb_gains[c]
            arr = np.clip(arr, 0, 255)

    # 2. Illumination Flat-fielding
    if auto_flatfield:
        small = Image.fromarray(arr.astype(np.uint8)).resize((40, 26), Image.Resampling.BILINEAR)
        small_bg = small.filter(ImageFilter.MaxFilter(size=5)).filter(ImageFilter.GaussianBlur(radius=4))
        bg = np.array(small_bg.resize((w, h), Image.Resampling.BICUBIC), dtype=np.float32)
        bg = np.maximum(bg, 50.0)
        norm = (arr / bg) * 195.0
        norm = np.clip(norm, 0, 255)
    else:
        norm = arr.copy()

    # 3. Tone Curve
    black_pt = max(5.0, 30.0 / max(contrast, 0.2))
    white_pt = min(250.0, 192.0 / max(brightness, 0.2))
    gamma = 1.08 * contrast

    scaled = (norm - black_pt) / max(white_pt - black_pt, 1.0)
    scaled = np.clip(scaled, 0.0, 1.0)
    curved = np.power(scaled, gamma) * 255.0

    # Softly push near-white background to pure white
    near_white = curved > 245.0
    curved[near_white] = 250.0 + (curved[near_white] - 245.0) * (5.0 / 10.0)
    curved = np.clip(curved, 0.0, 255.0)

    res = Image.fromarray(curved.astype(np.uint8))
    res = res.filter(ImageFilter.UnsharpMask(radius=1.0, percent=70, threshold=3))

    # Add subtle border to clean any pixel edges
    res_bordered = ImageOps.expand(res, border=1, fill="#cccccc")
    return res_bordered


def draw_dashed(draw, pt1, pt2, fill="#888888", width=2, dash=16, gap=10):
    x1, y1 = pt1
    x2, y2 = pt2
    dx, dy = x2 - x1, y2 - y1
    dist = (dx**2 + dy**2)**0.5
    if dist == 0:
        return
    ux, uy = dx / dist, dy / dist
    curr = 0
    while curr < dist:
        sx, sy = x1 + ux * curr, y1 + uy * curr
        ed = min(curr + dash, dist)
        ex, ey = x1 + ux * ed, y1 + uy * ed
        draw.line([(sx, sy), (ex, ey)], fill=fill, width=width)
        curr += dash + gap


def generate_a4_page(front_img, back_img, layout="document"):
    """
    Generates a 300 DPI A4 page (2480 x 3508)
    Layouts:
      'document'  : Front and Back stacked vertically, large format for KYC / official filing
      'wallet'    : Exact 1:1 physical scale (89mm x 57mm) with center fold line and cut guides
      'all_in_one': Both 1:1 wallet cards (top) and enlarged document copy (bottom)
      'full_document': Full page A4 print of a single document
    """
    if layout == "full_document":
        return generate_document_page(front_img)

    page_w, page_h = 2480, 3508
    page = Image.new("RGB", (page_w, page_h), "#ffffff")
    draw = ImageDraw.Draw(page)

    font_path_bold = "/usr/share/fonts/truetype/croscore/Arimo-Bold.ttf"
    font_path_reg = "/usr/share/fonts/truetype/croscore/Arimo-Regular.ttf"

    def font(bold, size):
        p = font_path_bold if bold else font_path_reg
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            return ImageFont.load_default()

    if layout == "document":
        # Title
        draw.text((page_w // 2, 170), "ID CARD - DOCUMENT VERIFICATION COPY", fill="#111111", font=font(True, 46), anchor="mt")
        draw.text((page_w // 2, 235), "Print Ready Layout • Single Page", fill="#555555", font=font(False, 26), anchor="mt")
        draw.line([(180, 290), (page_w - 180, 290)], fill="#cccccc", width=3)

        card_w = 1580
        card_h = int(card_w * (front_img.height / front_img.width))

        f_res = front_img.resize((card_w, card_h), Image.Resampling.LANCZOS)
        b_res = back_img.resize((card_w, card_h), Image.Resampling.LANCZOS)
        card_x = (page_w - card_w) // 2

        # Front
        yf_badge = 360
        draw.rounded_rectangle([card_x, yf_badge, card_x + 220, yf_badge + 46], radius=6, fill="#0d47a1")
        draw.text((card_x + 110, yf_badge + 23), "FRONT SIDE", fill="#ffffff", font=font(True, 28), anchor="mm")
        yf_card = yf_badge + 65
        page.paste(f_res, (card_x, yf_card))
        draw.rectangle([card_x - 1, yf_card - 1, card_x + card_w + 1, yf_card + card_h + 1], outline="#cccccc", width=2)

        # Back
        yb_badge = yf_card + card_h + 90
        draw.rounded_rectangle([card_x, yb_badge, card_x + 220, yb_badge + 46], radius=6, fill="#1b5e20")
        draw.text((card_x + 110, yb_badge + 23), "BACK SIDE", fill="#ffffff", font=font(True, 28), anchor="mm")
        yb_card = yb_badge + 65
        page.paste(b_res, (card_x, yb_card))
        draw.rectangle([card_x - 1, yb_card - 1, card_x + card_w + 1, yb_card + card_h + 1], outline="#cccccc", width=2)

        # Footer
        draw.line([(180, page_h - 220), (page_w - 180, page_h - 220)], fill="#cccccc", width=2)
        draw.text((page_w // 2, page_h - 170), "Print Settings: Page Size = A4 | Scale = 100% (Actual Size) | Orientation = Portrait", fill="#555555", font=font(False, 24), anchor="mt")

    elif layout == "wallet":
        # Exact 89mm x 57mm (1051 x 673 px @ 300 DPI)
        card_w, card_h = 1051, 673
        f_res = front_img.resize((card_w, card_h), Image.Resampling.LANCZOS)
        b_res = back_img.resize((card_w, card_h), Image.Resampling.LANCZOS)

        draw.text((page_w // 2, 220), "ID CARD - WALLET / LAMINATION PRINT (1:1 SCALE)", fill="#111111", font=font(True, 46), anchor="mt")
        draw.text((page_w // 2, 290), "Printed at 100% actual physical size (89 mm x 57 mm). Ready to cut, fold & laminate.", fill="#555555", font=font(False, 28), anchor="mt")
        draw.line([(200, 350), (page_w - 200, 350)], fill="#cccccc", width=3)

        card_x = (page_w - card_w) // 2
        top_y = 560

        page.paste(f_res, (card_x, top_y))
        fold_y = top_y + card_h
        draw_dashed(draw, (card_x - 140, fold_y), (card_x + card_w + 140, fold_y), fill="#d32f2f", width=3, dash=20, gap=12)
        draw.text((card_x - 150, fold_y), "FOLD LINE >>", fill="#d32f2f", font=font(True, 26), anchor="rm")
        draw.text((card_x + card_w + 150, fold_y), "<< FOLD LINE", fill="#d32f2f", font=font(True, 26), anchor="lm")
        page.paste(b_res, (card_x, fold_y))

        # Cut border
        pad = 20
        cut_box = [card_x - pad, top_y - pad, card_x + card_w + pad, top_y + 2*card_h + pad]
        draw_dashed(draw, (cut_box[0], cut_box[1]), (cut_box[2], cut_box[1]), fill="#444444", width=2)
        draw_dashed(draw, (cut_box[2], cut_box[1]), (cut_box[2], cut_box[3]), fill="#444444", width=2)
        draw_dashed(draw, (cut_box[2], cut_box[3]), (cut_box[0], cut_box[3]), fill="#444444", width=2)
        draw_dashed(draw, (cut_box[0], cut_box[3]), (cut_box[0], cut_box[1]), fill="#444444", width=2)

        draw.text((page_w // 2, cut_box[1] - 35), "--- [ CUT ALONG DOTTED LINE ] ---", fill="#444444", font=font(True, 24), anchor="mm")
        draw.text((page_w // 2, cut_box[3] + 35), "--- [ CUT ALONG DOTTED LINE ] ---", fill="#444444", font=font(True, 24), anchor="mm")

        # Instructions
        inst_y = cut_box[3] + 160
        draw.rounded_rectangle([page_w // 2 - 620, inst_y, page_w // 2 + 620, inst_y + 400], radius=12, fill="#f8f9fa", outline="#dddddd", width=2)
        draw.text((page_w // 2, inst_y + 42), "HOW TO MAKE YOUR POCKET WALLET ID CARD", fill="#0d47a1", font=font(True, 26), anchor="mm")
        draw.text((page_w // 2 - 570, inst_y + 105), "1. In Print Dialog, select Paper Size: A4 and Scaling: 100% / Actual Size (DO NOT fit to page).", fill="#222222", font=font(False, 24))
        draw.text((page_w // 2 - 570, inst_y + 165), "2. Use scissors to cut along the outer black dotted rectangle.", fill="#222222", font=font(False, 24))
        draw.text((page_w // 2 - 570, inst_y + 225), "3. Fold the card backwards along the red dashed center FOLD LINE.", fill="#222222", font=font(False, 24))
        draw.text((page_w // 2 - 570, inst_y + 285), "4. Both Front and Back align back-to-back at standard card size (89 mm x 57 mm).", fill="#222222", font=font(False, 24))
        draw.text((page_w // 2 - 570, inst_y + 345), "5. Insert into standard card pouch or laminate for a durable, water-resistant ID card.", fill="#222222", font=font(False, 24))

        # Ruler
        ruler_y = inst_y + 465
        ruler_w = int(50.0 / 25.4 * 300)
        ruler_x = (page_w - ruler_w) // 2
        draw.line([(ruler_x, ruler_y), (ruler_x + ruler_w, ruler_y)], fill="#222222", width=3)
        for mm in range(0, 51, 10):
            tx = ruler_x + int(mm / 50.0 * ruler_w)
            draw.line([(tx, ruler_y - 15), (tx, ruler_y + 15)], fill="#222222", width=2)
            draw.text((tx, ruler_y + 25), f"{mm//10} cm", fill="#444444", font=font(False, 20), anchor="mt")
        draw.text((page_w // 2, ruler_y - 30), "Scale Verification Ruler (must measure exactly 5 cm when printed)", fill="#555555", font=font(False, 20), anchor="mb")

    elif layout == "all_in_one":
        draw.text((page_w // 2, 100), "ID CARD - ALL-IN-ONE PRINT LAYOUT", fill="#0d47a1", font=font(True, 42), anchor="mt")
        draw.text((page_w // 2, 160), "1:1 Wallet Cut-and-Fold (Top) + KYC Verification Copy (Bottom)", fill="#444444", font=font(False, 24), anchor="mt")
        draw.line([(140, 215), (page_w - 140, 215)], fill="#bbbbbb", width=3)

        # 1:1 side by side
        card_w_1to1 = 1020
        card_h_1to1 = int(card_w_1to1 * (front_img.height / front_img.width))
        f_1to1 = front_img.resize((card_w_1to1, card_h_1to1), Image.Resampling.LANCZOS)
        b_1to1 = back_img.resize((card_w_1to1, card_h_1to1), Image.Resampling.LANCZOS)

        sec1_y = 250
        draw.rounded_rectangle([140, sec1_y, 760, sec1_y + 44], radius=6, fill="#1a237e")
        draw.text((450, sec1_y + 22), "SECTION 1: WALLET SIZE (1:1 SCALE)", fill="#ffffff", font=font(True, 26), anchor="mm")
        draw.text((790, sec1_y + 22), "• Cut out along dashed lines for wallet or lamination pouch", fill="#555555", font=font(False, 24), anchor="lm")

        gap_x = 70
        cards_x = (page_w - (2 * card_w_1to1 + gap_x)) // 2
        cards_y = sec1_y + 80

        draw.text((cards_x + card_w_1to1 // 2, cards_y - 12), "FRONT SIDE", fill="#0d47a1", font=font(True, 22), anchor="mb")
        page.paste(f_1to1, (cards_x, cards_y))
        pad = 10
        draw_dashed(draw, (cards_x - pad, cards_y - pad), (cards_x + card_w_1to1 + pad, cards_y - pad), fill="#888888")
        draw_dashed(draw, (cards_x + card_w_1to1 + pad, cards_y - pad), (cards_x + card_w_1to1 + pad, cards_y + card_h_1to1 + pad), fill="#888888")
        draw_dashed(draw, (cards_x + card_w_1to1 + pad, cards_y + card_h_1to1 + pad), (cards_x - pad, cards_y + card_h_1to1 + pad), fill="#888888")
        draw_dashed(draw, (cards_x - pad, cards_y + card_h_1to1 + pad), (cards_x - pad, cards_y - pad), fill="#888888")

        back_x = cards_x + card_w_1to1 + gap_x
        draw.text((back_x + card_w_1to1 // 2, cards_y - 12), "BACK SIDE", fill="#1b5e20", font=font(True, 22), anchor="mb")
        page.paste(b_1to1, (back_x, cards_y))
        draw_dashed(draw, (back_x - pad, cards_y - pad), (back_x + card_w_1to1 + pad, cards_y - pad), fill="#888888")
        draw_dashed(draw, (back_x + card_w_1to1 + pad, cards_y - pad), (back_x + card_w_1to1 + pad, cards_y + card_h_1to1 + pad), fill="#888888")
        draw_dashed(draw, (back_x + card_w_1to1 + pad, cards_y + card_h_1to1 + pad), (back_x - pad, cards_y + card_h_1to1 + pad), fill="#888888")
        draw_dashed(draw, (back_x - pad, cards_y + card_h_1to1 + pad), (back_x - pad, cards_y - pad), fill="#888888")

        div_y = cards_y + card_h_1to1 + 65
        draw.line([(140, div_y), (page_w - 140, div_y)], fill="#cccccc", width=3)

        # Section 2: Large
        sec2_y = div_y + 35
        draw.rounded_rectangle([140, sec2_y, 760, sec2_y + 44], radius=6, fill="#1b5e20")
        draw.text((450, sec2_y + 22), "SECTION 2: KYC & DOCUMENT COPY", fill="#ffffff", font=font(True, 26), anchor="mm")
        draw.text((790, sec2_y + 22), "• Large format for official submission & verification", fill="#555555", font=font(False, 24), anchor="lm")

        doc_w = 1460
        doc_h = int(doc_w * (front_img.height / front_img.width))
        f_doc = front_img.resize((doc_w, doc_h), Image.Resampling.LANCZOS)
        b_doc = back_img.resize((doc_w, doc_h), Image.Resampling.LANCZOS)
        doc_x = (page_w - doc_w) // 2

        yd_f = sec2_y + 80
        draw.text((doc_x, yd_f - 12), "FRONT SIDE (ENLARGED)", fill="#0d47a1", font=font(True, 22), anchor="lb")
        page.paste(f_doc, (doc_x, yd_f))
        draw.rectangle([doc_x - 1, yd_f - 1, doc_x + doc_w + 1, yd_f + doc_h + 1], outline="#cccccc", width=2)

        yd_b = yd_f + doc_h + 65
        draw.text((doc_x, yd_b - 12), "BACK SIDE (ENLARGED)", fill="#1b5e20", font=font(True, 22), anchor="lb")
        page.paste(b_doc, (doc_x, yd_b))
        draw.rectangle([doc_x - 1, yd_b - 1, doc_x + doc_w + 1, yd_b + doc_h + 1], outline="#cccccc", width=2)

        draw.line([(140, page_h - 110), (page_w - 140, page_h - 110)], fill="#cccccc", width=2)
        draw.text((page_w // 2, page_h - 75), "Print Settings: Paper Size = A4 | Scaling = 100% / Actual Size | Orientation = Portrait", fill="#666666", font=font(False, 22), anchor="mm")

    return page

def generate_document_page(doc_img):
    """
    Generates a 300 DPI A4 page containing a single full-page document,
    scaled to fit while maintaining aspect ratio, with a 50-pixel margin.
    """
    page_w, page_h = 2480, 3508
    page = Image.new('RGB', (page_w, page_h), "white")
    
    padding = 50
    target_w = page_w - padding * 2
    target_h = page_h - padding * 2
    
    img_ratio = doc_img.width / doc_img.height
    target_ratio = target_w / target_h
    
    if img_ratio > target_ratio:
        draw_w = target_w
        draw_h = int(target_w / img_ratio)
    else:
        draw_h = target_h
        draw_w = int(target_h * img_ratio)
        
    doc_resized = doc_img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    x = (page_w - draw_w) // 2
    y = (page_h - draw_h) // 2
    
    page.paste(doc_resized, (x, y))
    
    draw = ImageDraw.Draw(page)
    draw.rectangle([x, y, x + draw_w, y + draw_h], outline="#cccccc", width=2)
    
    return page
