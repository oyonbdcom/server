export const generate = {
  doctor: {
    select: {
      id: true,
      slug: true,
      specialization: true,
      user: { select: { name: true, image: true } },
      department: {
        select: {
          name: true,
        },
      },
      gender: true,
      averageRating: true,
      reviewsCount: true,
    },
  },
  diagnostic: {
    select: {
      id: true,
      user: { select: { name: true } },
      area: true,
      address: true,
      slug: true,
      averageRating: true,
      reviewsCount: true,
    },
  },
  fee: true,
  schedules: true,
};
export const diagnosticSelect = {
  id: true,
  slug: true,
  //   area: true,
  //   address: true,
  //   averageRating: true,
  //   reviewsCount: true,
  user: {
    select: {
      name: true,
    },
  },
};
