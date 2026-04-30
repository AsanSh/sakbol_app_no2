"use client";

import { DoctorCard, type DoctorCardModel } from "@/features/home/DoctorCard";

type Props = {
  doctors: DoctorCardModel[];
  labels: {
    call: string;
    details: string;
    noPhone: string;
  };
  onCall: (doctor: DoctorCardModel) => void;
  onView: (doctor: DoctorCardModel) => void;
};

export function DoctorsList({ doctors, labels, onCall, onView }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {doctors.map((doctor) => (
        <DoctorCard
          key={doctor.slug}
          doctor={doctor}
          callLabel={labels.call}
          detailsLabel={labels.details}
          noPhoneLabel={labels.noPhone}
          onCall={onCall}
          onView={onView}
        />
      ))}
    </div>
  );
}
