from PIL import Image
base = r"C:\Users\admin\Desktop\workspace\topik-project\v13\.design-review-shots\20260609"
out = r"C:\Users\admin\Desktop\workspace\topik-project\v13\.scratch"
im = Image.open(base + r"\04-B-01-home-dashboard-1280.png"); print("1280 size", im.size)
im.crop((0, 0, 240, 320)).save(out + r"\b01_sidebar_top.png")
im.crop((255, 180, 985, 300)).save(out + r"\b01_kpi.png")
im2 = Image.open(base + r"\04-B-01-home-dashboard-768.png"); print("768 size", im2.size)
im2.crop((600, 330, 770, 560)).save(out + r"\b01_768_exam.png")
im3 = Image.open(base + r"\04-B-01-home-dashboard-360.png"); print("360 size", im3.size)
im3.crop((0, 0, 360, 120)).save(out + r"\b01_360_topbar.png")
im3.crop((0, 690, 360, 900)).save(out + r"\b01_360_avatar.png")
print("done")
